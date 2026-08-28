"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { createDraftDocumentFromTitle } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

const CreateDelegatedInstitutionActionInputSchema = v.object({
	// The section posts the country document id as a generic hidden `scopeDocumentId` field.
	scopeDocumentId: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.nonEmpty()),
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	ror: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
});

/**
 * Creates a new institution as a draft and locates it in the coordinator's country
 * (`is_located_in`), so it becomes selectable in the country-scoped institution picker. Publishing
 * remains an admin task. Authorized against the country the caller is editing.
 */
export const createDelegatedInstitutionAction = createServerAction(
	{ requireAuth: true },
	async function createDelegatedInstitutionAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(
			CreateDelegatedInstitutionActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof CreateDelegatedInstitutionActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { scopeDocumentId: countryDocumentId, name, acronym, ror, summary } = result.output;

		assert(user != null);
		await assertCan(user, "update", { type: "organisational_unit", id: countryDocumentId });

		const created = await db.transaction(async (tx) => {
			const entityType = await tx.query.entityTypes.findFirst({
				where: { type: "organisational_units" },
				columns: { id: true },
			});
			assert(entityType);

			const institutionType = await tx.query.organisationalUnitTypes.findFirst({
				where: { type: "institution" },
				columns: { id: true },
			});
			assert(institutionType);

			const locatedInStatus = await tx.query.organisationalUnitStatus.findFirst({
				where: { status: "is_located_in" },
				columns: { id: true },
			});
			assert(locatedInStatus);

			const { documentId, versionId } = await createDraftDocumentFromTitle(tx, entityType.id, name);

			await tx.insert(schema.organisationalUnits).values({
				id: versionId,
				acronym,
				name,
				ror,
				summary,
				typeId: institutionType.id,
			});

			await tx.insert(schema.organisationalUnitsRelations).values({
				unitDocumentId: documentId,
				relatedUnitDocumentId: countryDocumentId,
				status: locatedInStatus.id,
				duration: { start: new Date() },
			});

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "create",
				subjectType: "institutions",
				subjectId: documentId,
				summary: { name, lifecycle: "draft" },
			});

			return { documentId };
		});

		revalidatePath("/[locale]/dashboard/countries", "layout");

		return createActionStateSuccess({ data: { id: created.documentId, name } });
	},
);
