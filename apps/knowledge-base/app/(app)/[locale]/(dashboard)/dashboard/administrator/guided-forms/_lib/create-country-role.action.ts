"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { CreateCountryRoleActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/create-country-role.schema";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { createDraftDocumentFromTitle, publishVersion } from "@/lib/data/entity-lifecycle";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import {
	getExistingPersonRelations,
	getPersonRoleTypeIdsByType,
	resolveCountryRoleCounterpart,
	toInterval,
	widenDuration,
} from "@/lib/data/wizard-preflight";
import type { Transaction } from "@/lib/db";
import { isExclusionViolation } from "@/lib/db/errors";
import { eq } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { UserFacingError } from "@/lib/user-facing-error";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

/**
 * Appoints a national coordinator, national representative, or deputy — which means two relations,
 * not one: the role in the country, and the matching membership of the National Coordinator
 * Committee or General Assembly, over the same period.
 *
 * `pairedRelationRules` reports a missing or mismatched counterpart after the fact; writing both
 * rows in one transaction from one duration means the wizard cannot produce that finding. When a
 * counterpart already exists over an overlapping but different period, it is widened rather than
 * duplicated — a second row would collide with the duration-overlap exclusion constraint and would
 * be the wrong record anyway.
 */
export const createCountryRoleAction = createMutationAction({
	schema: CreateCountryRoleActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "persons" },
	revalidate: [
		"/[locale]/dashboard/administrator/persons",
		"/[locale]/dashboard/administrator/guided-forms",
	],

	async mutate(tx, input, { formData, user }) {
		const t = await getExtracted();

		let personDocumentId = input.personDocumentId;
		let personSlug: string | undefined;
		let didCreatePerson = false;

		if (personDocumentId == null) {
			const entityType = await tx.query.entityTypes.findFirst({
				where: { type: "persons" },
				columns: { id: true },
			});
			assert(entityType);

			const created = await createDraftDocumentFromTitle(tx, entityType.id, input.name);

			await tx.insert(schema.persons).values({
				id: created.versionId,
				name: input.name,
				sortName: input.sortName,
				email: input.email,
				orcid: input.orcid,
			});

			personDocumentId = created.documentId;
			personSlug = created.slug;
			didCreatePerson = true;

			if (shouldSaveAndPublish(formData)) {
				await publishVersion(tx, created.documentId, personsLifecycleAdapter);
			}
		}

		const requested = toInterval(input.start.toISOString(), input.end?.toISOString() ?? null);
		const existing = didCreatePerson ? [] : await getExistingPersonRelations(tx, personDocumentId);

		const counterpart = await resolveCountryRoleCounterpart(
			tx,
			input.roleType,
			existing,
			requested,
			input.counterpartRoleType,
		);

		// The paired rule names the governance body by slug; without that document there is no
		// counterpart row to write, and writing only the country role would create the very finding
		// this wizard exists to prevent.
		if (counterpart == null) {
			throw new UserFacingError("missing-paired-relation-unit");
		}

		const roleTypeIds = await getPersonRoleTypeIdsByType(tx, [
			input.roleType,
			counterpart.createAsRoleType,
		]);
		const roleTypeId = roleTypeIds.get(input.roleType);
		const counterpartRoleTypeId = roleTypeIds.get(counterpart.createAsRoleType);
		assert(roleTypeId);
		assert(counterpartRoleTypeId);

		const duration = { start: input.start, ...(input.end != null ? { end: input.end } : {}) };

		const isRoleRecorded = existing.some(
			(relation) =>
				relation.roleType === input.roleType &&
				relation.organisationalUnitDocumentId === input.countryDocumentId &&
				relation.start <= input.start &&
				(relation.end == null || (input.end != null && relation.end >= input.end)),
		);

		const created: Array<string> = [];

		if (!isRoleRecorded) {
			const id = await insertPersonRelation(tx, {
				personDocumentId,
				organisationalUnitDocumentId: input.countryDocumentId,
				roleTypeId,
				duration,
			});

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "create",
				subjectType: "create_contribution",
				subjectId: id,
				summary: {
					role: input.roleType,
					personDocumentId,
					organisationalUnitDocumentId: input.countryDocumentId,
					via: "wizard:country-role",
				},
			});

			created.push(input.roleType);
		}

		if (counterpart.rowToWiden != null) {
			await tx
				.update(schema.personsToOrganisationalUnits)
				.set({
					duration: widenDuration(counterpart.rowToWiden, {
						start: input.start,
						end: input.end,
					}),
				})
				.where(eq(schema.personsToOrganisationalUnits.id, counterpart.rowToWiden.id));

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "update",
				subjectType: "create_contribution",
				subjectId: counterpart.rowToWiden.id,
				summary: {
					rule: counterpart.rule,
					reason: "aligned counterpart duration",
					via: "wizard:country-role",
				},
			});
		} else if (!counterpart.isCovered) {
			const id = await insertPersonRelation(tx, {
				personDocumentId,
				organisationalUnitDocumentId: counterpart.unit.documentId,
				roleTypeId: counterpartRoleTypeId,
				duration,
			});

			await recordAuditEvent(tx, {
				actorUserId: user.id,
				action: "create",
				subjectType: "create_contribution",
				subjectId: id,
				summary: {
					role: counterpart.createAsRoleType,
					rule: counterpart.rule,
					personDocumentId,
					organisationalUnitDocumentId: counterpart.unit.documentId,
					via: "wizard:country-role",
				},
			});

			created.push(counterpart.createAsRoleType);
		}

		return {
			subjectId: personDocumentId,
			...(personSlug != null ? { subjectSlug: personSlug } : {}),
			auditSummary: {
				createdPerson: didCreatePerson,
				createdRelations: created,
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
				via: "wizard:country-role",
			},
			successMessage: t("The appointment and its committee membership have been saved."),
			successData: { personDocumentId, personSlug, createdRelations: created },
		};
	},

	async postCommit() {
		await dispatchWebhook({ type: "persons" });
	},
});

async function insertPersonRelation(
	tx: Transaction,
	values: {
		personDocumentId: string;
		organisationalUnitDocumentId: string;
		roleTypeId: string;
		duration: { start: Date; end?: Date };
	},
): Promise<string> {
	try {
		const [row] = await tx
			.insert(schema.personsToOrganisationalUnits)
			.values(values)
			.returning({ id: schema.personsToOrganisationalUnits.id });
		assert(row);

		return row.id;
	} catch (error) {
		// Same rule as for unit relations: a person may hold the same role over several
		// non-overlapping periods, so the database enforces it with a GiST exclusion constraint.
		if (isExclusionViolation(error, "persons_to_organisational_units_person_org_role_no_overlap")) {
			throw new UserFacingError("relation-period-overlap");
		}
		throw error;
	}
}
