"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpdateUnitRelationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-unit-relation.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { eq } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const updateUnitRelationAction = createServerAction(
	{ requireAdmin: true },
	async function updateUnitRelationAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();
		const result = await v.safeParseAsync(
			UpdateUnitRelationActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdateUnitRelationActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { id, unitDocumentId, statusId, relatedUnitDocumentId, duration } = result.output;

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(schema.organisationalUnitsRelations)
					.set({
						unitDocumentId,
						relatedUnitDocumentId,
						status: statusId,
						duration,
					})
					.where(eq(schema.organisationalUnitsRelations.id, id));

				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					action: "update",
					subjectType: "unit_relations",
					subjectId: id,
					summary: getAuditSummaryFromFormData(formData),
				});
			});

			revalidatePath("/[locale]/dashboard/administrator", "layout");
			return createActionStateSuccess({});
		} catch (error) {
			// A unit may hold the same relation to the same counterpart over several non-overlapping
			// periods; the duration-overlap rule is enforced by a GiST exclusion constraint. Translate
			// its violation rather than mirroring the rule here, so the database stays the single source
			// of truth.
			if (
				isExclusionViolation(error, "organisational_units_to_units_unit_related_status_no_overlap")
			) {
				return createActionStateError({
					message: t("This relation already exists during an overlapping period."),
				});
			}
			throw error;
		}
	},
);
