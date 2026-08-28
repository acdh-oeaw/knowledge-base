"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { CreatePartnerInstitutionActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/create-partner-institution.schema";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { createDraftDocumentFromTitle, publishVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import {
	getExistingUnitRelations,
	getUnitReferenceBySlug,
	getUnitStatusIdsByType,
	isRelationAlreadyRecorded,
	toInterval,
} from "@/lib/data/wizard-preflight";
import { isExclusionViolation } from "@/lib/db/errors";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { UserFacingError } from "@/lib/user-facing-error";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

/**
 * Writes everything the partner-institution wizard collected in one transaction: the institution
 * (when it is new), the `is_located_in` relation to its country, and its status towards DARIAH-EU.
 *
 * The point of the wizard is that these belong together — `is_located_in` is the one admins forget
 * when they create a partner institution from the normal screen, which
 * `unitRelationRequirementRules` then reports after the fact. Writing them atomically means the
 * wizard can never itself produce the half-finished state it exists to prevent.
 */
export const createPartnerInstitutionAction = createMutationAction({
	schema: CreatePartnerInstitutionActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "institutions" },
	revalidate: [
		"/[locale]/dashboard/administrator/institutions",
		"/[locale]/dashboard/administrator/guided-forms",
	],

	async mutate(tx, input, { formData, user }) {
		const t = await getExtracted();

		const eric = await getUnitReferenceBySlug(tx, "dariah-eu");
		if (eric == null) {
			throw new UserFacingError("missing-dariah-eric");
		}

		const statusIds = await getUnitStatusIdsByType(tx, ["is_located_in", input.statusType]);
		const locatedInStatusId = statusIds.get("is_located_in");
		const ericStatusId = statusIds.get(input.statusType);
		assert(locatedInStatusId);
		assert(ericStatusId);

		let institutionDocumentId = input.institutionDocumentId;
		let institutionSlug: string | undefined;
		let didCreateInstitution = false;

		if (institutionDocumentId == null) {
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

			// The slug is derived from the name: the wizard has no slug field, so a clash must not fail
			// the submit (see `createDraftDocumentFromTitle`).
			const created = await createDraftDocumentFromTitle(tx, entityType.id, input.name);

			await tx.insert(schema.organisationalUnits).values({
				id: created.versionId,
				acronym: input.acronym,
				name: input.name,
				ror: input.ror,
				summary: input.summary,
				typeId: institutionType.id,
			});

			institutionDocumentId = created.documentId;
			institutionSlug = created.slug;
			didCreateInstitution = true;

			if (shouldSaveAndPublish(formData)) {
				await publishVersion(tx, created.documentId, organisationalUnitsLifecycleAdapter);
			}
		}

		// The preflight the admin reviewed is a snapshot taken before the submit, so re-derive which
		// rows are still missing here. Skipping an already-recorded relation is the harmless outcome;
		// inserting it again would hit the duration-overlap exclusion constraint.
		const existing = didCreateInstitution
			? []
			: await getExistingUnitRelations(tx, institutionDocumentId);

		const relations = [
			{
				statusId: locatedInStatusId,
				statusType: "is_located_in" as const,
				relatedUnitDocumentId: input.countryDocumentId,
				duration: { start: input.locatedInStart },
				interval: toInterval(input.locatedInStart.toISOString(), null),
			},
			{
				statusId: ericStatusId,
				statusType: input.statusType,
				relatedUnitDocumentId: eric.documentId,
				duration: {
					start: input.statusStart,
					...(input.statusEnd != null ? { end: input.statusEnd } : {}),
				},
				interval: toInterval(
					input.statusStart.toISOString(),
					input.statusEnd?.toISOString() ?? null,
				),
			},
		];

		const createdRelationTypes: Array<string> = [];

		for (const relation of relations) {
			if (
				isRelationAlreadyRecorded(
					existing,
					relation.statusType,
					relation.relatedUnitDocumentId,
					relation.interval,
				)
			) {
				continue;
			}

			let row: { id: string } | undefined;

			try {
				[row] = await tx
					.insert(schema.organisationalUnitsRelations)
					.values({
						unitDocumentId: institutionDocumentId,
						relatedUnitDocumentId: relation.relatedUnitDocumentId,
						status: relation.statusId,
						duration: relation.duration,
					})
					.returning({ id: schema.organisationalUnitsRelations.id });
			} catch (error) {
				// The same relation may recur over non-overlapping periods, so uniqueness is enforced by
				// a GiST exclusion constraint rather than a unique index. The skip above handles the
				// fully-covered case; a partial overlap still has to be reported, and the database stays
				// the single source of truth for the rule.
				if (
					isExclusionViolation(
						error,
						"organisational_units_to_units_unit_related_status_no_overlap",
					)
				) {
					throw new UserFacingError("relation-period-overlap");
				}
				throw error;
			}

			assert(row);

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "create",
				subjectType: "create_unit_relation",
				subjectId: row.id,
				summary: {
					status: relation.statusType,
					unitDocumentId: institutionDocumentId,
					relatedUnitDocumentId: relation.relatedUnitDocumentId,
					via: "wizard:partner-institution",
				},
			});

			createdRelationTypes.push(relation.statusType);
		}

		return {
			subjectId: institutionDocumentId,
			...(institutionSlug != null ? { subjectSlug: institutionSlug } : {}),
			auditSummary: {
				createdInstitution: didCreateInstitution,
				createdRelations: createdRelationTypes,
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
				via: "wizard:partner-institution",
			},
			successMessage: t("The partner institution and its relations have been saved."),
			successData: {
				institutionDocumentId,
				institutionSlug,
				createdRelations: createdRelationTypes,
			},
		};
	},

	async postCommit({ result, ctx }) {
		if (!shouldSaveAndPublish(ctx.formData)) {
			return;
		}

		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "members-partners" });
	},
});
