"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { assertCanEditCountryInstitution } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { ensureDraftVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

const UpdateDelegatedInstitutionActionInputSchema = v.object({
	documentId: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.nonEmpty()),
	acronym: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	ror: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
	summary: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
});

/**
 * Edits the core metadata of an institution as a draft. A delegated caller may edit an institution
 * only when it `is_located_in` a country they are scoped to edit; publishing remains an admin
 * task.
 */
export const updateDelegatedInstitutionAction = createServerAction(
	{ requireAuth: true },
	async function updateDelegatedInstitutionAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(
			UpdateDelegatedInstitutionActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdateDelegatedInstitutionActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { documentId, name, acronym, ror, summary } = result.output;

		assert(user != null);
		await assertCanEditCountryInstitution(user, documentId);

		await db.transaction(async (tx) => {
			const draftVersionId = await ensureDraftVersion(
				tx,
				documentId,
				organisationalUnitsLifecycleAdapter,
			);

			await tx
				.update(schema.organisationalUnits)
				.set({ acronym, name, ror, summary })
				.where(eq(schema.organisationalUnits.id, draftVersionId));

			await touchVersion(tx, draftVersionId);

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "update",
				subjectType: "institutions",
				subjectId: documentId,
				summary: { name, lifecycle: "draft" },
			});
		});

		revalidatePath("/[locale]/dashboard/countries", "layout");

		return createActionStateSuccess({ data: { name } });
	},
);
