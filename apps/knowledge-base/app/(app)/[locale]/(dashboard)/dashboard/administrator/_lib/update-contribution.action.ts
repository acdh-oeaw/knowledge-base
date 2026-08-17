"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { UpdateContributionActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-contribution.schema";
import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { db } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { and, eq, sql } from "@/lib/db/sql";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const updateContributionAction = createServerAction(
	{ requireAdmin: true },
	async function updateContributionAction(state, formData, { user }) {
		const locale = await getLocale();
		const t = await getExtracted();
		const result = await v.safeParseAsync(
			UpdateContributionActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdateContributionActionInputSchema>(result.issues);
			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { id, personDocumentId, roleTypeId, organisationalUnitDocumentId, duration } =
			result.output;

		try {
			const returned = await db.transaction(async (tx) => {
				const unit = await tx
					.select({
						unitType: schema.organisationalUnitTypes.type,
						allowedRelationId: schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.id,
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
					.leftJoin(
						schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations,
						and(
							eq(
								schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.unitTypeId,
								schema.organisationalUnits.typeId,
							),
							eq(
								schema.personRoleTypesToOrganisationalUnitTypesAllowedRelations.roleTypeId,
								roleTypeId,
							),
						),
					)
					.where(eq(schema.documentLifecycle.documentId, organisationalUnitDocumentId))
					.limit(1)
					.then((rows) => rows[0] ?? null);

				if (unit?.allowedRelationId == null) {
					return { error: "role-not-allowed" as const };
				}

				await tx
					.update(schema.personsToOrganisationalUnits)
					.set({
						personDocumentId,
						organisationalUnitDocumentId,
						roleTypeId,
						duration,
					})
					.where(eq(schema.personsToOrganisationalUnits.id, id));

				await recordAuditEvent(tx, {
					actorUserId: user?.id,
					action: "update",
					subjectType: "contributions",
					subjectId: id,
					summary: getAuditSummaryFromFormData(formData),
				});

				return { ok: true as const };
			});

			if ("error" in returned) {
				return createActionStateError({
					message: t("The selected role is not allowed for this organisation."),
				});
			}

			revalidatePath("/[locale]/dashboard/administrator", "layout");
			return createActionStateSuccess({});
		} catch (error) {
			// A person may hold the same role at the same org over several non-overlapping periods; the
			// duration-overlap rule is enforced by a GiST exclusion constraint. Translate its violation
			// rather than mirroring the rule here, so the database stays the single source of truth.
			if (
				isExclusionViolation(error, "persons_to_organisational_units_person_org_role_no_overlap")
			) {
				return createActionStateError({
					message: t(
						"This person already holds this role at this organisation during an overlapping period.",
					),
				});
			}
			throw error;
		}
	},
);
