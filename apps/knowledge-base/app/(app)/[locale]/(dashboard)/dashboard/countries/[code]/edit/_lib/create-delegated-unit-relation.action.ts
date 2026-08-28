"use server";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { CreateUnitRelationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.schema";
import { assertCanManageCountryInstitutionRelation } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

/**
 * Delegated counterpart of `createUnitRelationAction`, scoped to the partner-institution relations
 * a national coordinator manages on their country dashboard (`institution -> DARIAH ERIC`).
 * Authorization is derived from the institution's `is_located_in` country, never from
 * client-supplied scope.
 */
export const createDelegatedUnitRelationAction = createServerAction(
	{ requireAuth: true },
	async function createDelegatedUnitRelationAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();

		const result = await v.safeParseAsync(
			CreateUnitRelationActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof CreateUnitRelationActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { unitDocumentId, statusId, relatedUnitDocumentId, duration, description } =
			result.output;

		assert(user != null);
		await assertCanManageCountryInstitutionRelation(user, {
			institutionDocumentId: unitDocumentId,
			relatedUnitDocumentId,
		});

		try {
			const row = await db.transaction(async (tx) => {
				const inserted = await tx
					.insert(schema.organisationalUnitsRelations)
					.values({
						unitDocumentId,
						relatedUnitDocumentId,
						status: statusId,
						duration,
						description,
					})
					.returning({ id: schema.organisationalUnitsRelations.id })
					.then((rows) => rows[0]!);

				await recordAuditEvent(tx, {
					actorUserId: user.id,
					action: "create",
					subjectType: "create_unit_relation",
					subjectId: inserted.id,
					summary: getAuditSummaryFromFormData(formData),
				});

				return inserted;
			});

			revalidatePath("/[locale]/dashboard/countries", "layout");

			return createActionStateSuccess({
				data: {
					id: row.id,
					durationStart: duration.start.toISOString(),
					durationEnd: duration.end?.toISOString() ?? null,
					description,
				},
			});
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
