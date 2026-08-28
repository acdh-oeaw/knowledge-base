import * as schema from "@dariah-eric/database/schema";

import { type Database, type Transaction, db } from "@/lib/db";
import { alias, and, eq, inArray, sql } from "@/lib/db/sql";

export type WorkingGroupChairRole = (typeof schema.workingGroupReportChairRoleEnum)[number];

export interface WorkingGroupChairCandidate {
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	chairRole: WorkingGroupChairRole;
}

function durationOverlapsYear(year: number) {
	return sql`
		${schema.personsToOrganisationalUnits.duration} && tstzrange (
			MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
			MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
		)
	`;
}

/** Chair and vice-chair relations active for a working group during a reporting year. */
export async function getWorkingGroupChairCandidates(
	workingGroupDocumentId: string,
	year: number,
	queryDb: Database | Transaction = db,
): Promise<Array<WorkingGroupChairCandidate>> {
	const personLifecycle = alias(schema.documentLifecycle, "wg_chair_candidate_person_lifecycle");
	const personEntities = alias(schema.entities, "wg_chair_candidate_person_entities");
	const personSlugs = alias(schema.slugs, "wg_chair_candidate_person_slugs");

	const rows = await queryDb
		.select({
			personToOrgUnitId: schema.personsToOrganisationalUnits.id,
			personName: schema.persons.name,
			personSlug: personSlugs.value,
			chairRole: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			personEntities,
			eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(personLifecycle, eq(personLifecycle.documentId, personEntities.id))
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personLifecycle.draftId}, ${personLifecycle.publishedId})`,
		)
		.innerJoin(personSlugs, eq(personSlugs.entityVersionId, schema.persons.id))
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(
			and(
				eq(
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
					workingGroupDocumentId,
				),
				inArray(schema.personRoleTypes.type, [...schema.workingGroupReportChairRoleEnum]),
				durationOverlapsYear(year),
			),
		)
		.orderBy(schema.persons.sortName, schema.personRoleTypes.type);

	return rows.map((row) => {
		return { ...row, chairRole: row.chairRole as WorkingGroupChairRole };
	});
}

export interface WorkingGroupReportChairSnapshot extends WorkingGroupChairCandidate {
	id: string;
}

export function getWorkingGroupChairSnapshotDrift(
	storedChairs: ReadonlyArray<WorkingGroupReportChairSnapshot>,
	currentChairs: ReadonlyArray<WorkingGroupChairCandidate>,
): {
	chairs: Array<WorkingGroupReportChairSnapshot & { isCurrent: boolean }>;
	missing: Array<WorkingGroupChairCandidate>;
} {
	const snapshotKey = (relationId: string, role: WorkingGroupChairRole) => `${relationId}:${role}`;
	const currentKeys = new Set(
		currentChairs.map((chair) => snapshotKey(chair.personToOrgUnitId, chair.chairRole)),
	);
	const storedKeys = new Set(
		storedChairs.map((chair) => snapshotKey(chair.personToOrgUnitId, chair.chairRole)),
	);

	return {
		chairs: storedChairs.map((chair) => {
			return {
				...chair,
				isCurrent: currentKeys.has(snapshotKey(chair.personToOrgUnitId, chair.chairRole)),
			};
		}),
		missing: currentChairs.filter(
			(chair) => !storedKeys.has(snapshotKey(chair.personToOrgUnitId, chair.chairRole)),
		),
	};
}

/** Stored chair snapshots, with person display metadata resolved from the current person version. */
export async function getWorkingGroupReportChairs(
	workingGroupReportId: string,
): Promise<Array<WorkingGroupReportChairSnapshot>> {
	const personLifecycle = alias(schema.documentLifecycle, "wg_report_chair_person_lifecycle");
	const personEntities = alias(schema.entities, "wg_report_chair_person_entities");
	const personSlugs = alias(schema.slugs, "wg_report_chair_person_slugs");

	return db
		.select({
			id: schema.workingGroupReportChairs.id,
			personToOrgUnitId: schema.workingGroupReportChairs.personToOrgUnitId,
			personName: schema.persons.name,
			personSlug: personSlugs.value,
			chairRole: schema.workingGroupReportChairs.chairRole,
		})
		.from(schema.workingGroupReportChairs)
		.innerJoin(
			schema.personsToOrganisationalUnits,
			eq(schema.personsToOrganisationalUnits.id, schema.workingGroupReportChairs.personToOrgUnitId),
		)
		.innerJoin(
			personEntities,
			eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(personLifecycle, eq(personLifecycle.documentId, personEntities.id))
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personLifecycle.draftId}, ${personLifecycle.publishedId})`,
		)
		.innerJoin(personSlugs, eq(personSlugs.entityVersionId, schema.persons.id))
		.where(eq(schema.workingGroupReportChairs.workingGroupReportId, workingGroupReportId))
		.orderBy(schema.persons.sortName, schema.workingGroupReportChairs.chairRole);
}
