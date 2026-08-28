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

const CreateDelegatedPersonActionInputSchema = v.object({
	organisationalUnitDocumentId: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.nonEmpty()),
	sortName: v.pipe(v.string(), v.nonEmpty()),
});

/**
 * Creates a new person as a draft, so a delegated caller (working-group chair, national
 * coordinator) can add someone who is not yet in the system and immediately relate them to the unit
 * they manage. Publishing the person remains an admin task. Authorized against the organisational
 * unit the caller is editing.
 */
export const createDelegatedPersonAction = createServerAction(
	{ requireAuth: true },
	async function createDelegatedPersonAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(
			CreateDelegatedPersonActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof CreateDelegatedPersonActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { organisationalUnitDocumentId, name, sortName } = result.output;

		assert(user != null);
		await assertCan(user, "update", {
			type: "organisational_unit",
			id: organisationalUnitDocumentId,
		});

		const created = await db.transaction(async (tx) => {
			const entityType = await tx.query.entityTypes.findFirst({
				where: { type: "persons" },
				columns: { id: true },
			});
			assert(entityType);

			const { documentId, versionId } = await createDraftDocumentFromTitle(tx, entityType.id, name);

			await tx.insert(schema.persons).values({ id: versionId, name, sortName });

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "create",
				subjectType: "persons",
				subjectId: documentId,
				summary: { name, sortName, lifecycle: "draft" },
			});

			return { documentId };
		});

		revalidatePath("/[locale]/dashboard", "layout");

		return createActionStateSuccess({ data: { id: created.documentId, name, sortName } });
	},
);
