"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpdateUnitRelationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-unit-relation.schema";
import { assertCanManageCountryInstitutionRelation } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { eq } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

/**
 * Delegated counterpart of `updateUnitRelationAction` for the partner-institution relations on a
 * country dashboard. Authorizes against both the relation's current institution and the submitted
 * one, so a delegated caller can neither edit a relation outside their scope nor move one into it.
 */
export const updateDelegatedUnitRelationAction = createServerAction(
	{ requireAuth: true },
	async function updateDelegatedUnitRelationAction(state, formData, { user }) {
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

		const { id, unitDocumentId, statusId, relatedUnitDocumentId, duration, description } =
			result.output;

		assert(user != null);
		const existing = await db.query.organisationalUnitsRelations.findFirst({
			where: { id },
			columns: { unitDocumentId: true, relatedUnitDocumentId: true },
		});
		if (existing != null) {
			await assertCanManageCountryInstitutionRelation(user, {
				institutionDocumentId: existing.unitDocumentId,
				relatedUnitDocumentId: existing.relatedUnitDocumentId,
			});
		}
		await assertCanManageCountryInstitutionRelation(user, {
			institutionDocumentId: unitDocumentId,
			relatedUnitDocumentId,
		});

		try {
			await db.transaction(async (tx) => {
				await tx
					.update(schema.organisationalUnitsRelations)
					.set({
						unitDocumentId,
						relatedUnitDocumentId,
						status: statusId,
						duration,
						description,
					})
					.where(eq(schema.organisationalUnitsRelations.id, id));

				await recordAuditEvent(tx, {
					actorUserId: user.id,
					action: "update",
					subjectType: "unit_relations",
					subjectId: id,
					summary: getAuditSummaryFromFormData(formData),
				});
			});

			revalidatePath("/[locale]/dashboard/countries", "layout");
			return createActionStateSuccess({});
		} catch (error) {
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
