"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { createActionStateError, createActionStateSuccess } from "@acdh-knowledge-base/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { CreateUnitRelationActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { eq, sql } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

/** Uses createServerAction because the success response carries typed data. */
export const createUnitRelationAction = createServerAction(
	{ requireAdmin: true },
	async function createUnitRelationAction(state, formData, { user }) {
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

		const { unitDocumentId, statusId, relatedUnitDocumentId, duration } = result.output;

		try {
			const returned = await db.transaction(async (tx) => {
				// Resolve the related unit's current version (draft-or-published) for its type.
				const relatedUnit = await tx
					.select({
						unitType: schema.organisationalUnitTypes.type,
						slug: schema.entities.slug,
					})
					.from(schema.organisationalUnits)
					.innerJoin(
						schema.documentLifecycle,
						sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
					)
					.innerJoin(
						schema.organisationalUnitTypes,
						eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
					)
					.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
					.where(eq(schema.documentLifecycle.documentId, relatedUnitDocumentId))
					.limit(1)
					.then((rows) => rows[0] ?? null);

				const row = await tx
					.insert(schema.organisationalUnitsRelations)
					.values({
						unitDocumentId,
						relatedUnitDocumentId,
						status: statusId,
						duration,
					})
					.returning({ id: schema.organisationalUnitsRelations.id })
					.then((rows) => rows[0]!);

				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					action: "create",
					subjectType: "create_unit_relation",
					subjectId: row.id,
					summary: getAuditSummaryFromFormData(formData),
				});

				return {
					relatedUnitType: relatedUnit?.unitType,
					relatedUnitSlug: relatedUnit?.slug,
					row,
				};
			});

			revalidatePath("/[locale]/dashboard/administrator", "layout");

			return createActionStateSuccess({
				data: {
					id: returned.row.id,
					durationStart: duration.start.toISOString(),
					durationEnd: duration.end?.toISOString() ?? null,
					relatedUnitType: returned.relatedUnitType,
					relatedUnitSlug: returned.relatedUnitSlug,
				},
			});
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
