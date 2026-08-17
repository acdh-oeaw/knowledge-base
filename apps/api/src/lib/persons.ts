import * as schema from "@dariah-eric/database/schema";

import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, eq, inArray, sql } from "@/services/db/sql";

export interface PersonPosition {
	role: (typeof schema.personRoleTypesEnum)[number];
	name: string;
	type: (typeof schema.organisationalUnitTypesEnum)[number];
}

// Positions are surfaced in a fixed hierarchy of relation types so the order is consistent across
// endpoints: national-consortium roles first, then governance-body roles by seniority, affiliation
// last. The org-unit name is the tiebreaker within a role.
const positionRolePriority: Record<(typeof schema.personRoleTypesEnum)[number], number> = {
	national_coordinator: 0,
	national_coordinator_deputy: 1,
	national_coordination_staff: 2,
	national_representative: 3,
	national_representative_deputy: 4,
	is_chair_of: 5,
	is_vice_chair_of: 6,
	is_member_of: 7,
	is_contact_for: 8,
	is_affiliated_with: 9,
};

function comparePositions(a: PersonPosition, b: PersonPosition): number {
	const byRole = positionRolePriority[a.role] - positionRolePriority[b.role];
	if (byRole !== 0) {
		return byRole;
	}
	return a.name.localeCompare(b.name);
}

export async function getPersonPositions(
	db: Database | Transaction,
	personIds: Array<string>,
): Promise<Map<string, Array<PersonPosition> | null>> {
	const positions = new Map<string, Array<PersonPosition> | null>();

	for (const personId of personIds) {
		positions.set(personId, null);
	}

	if (personIds.length === 0) {
		return positions;
	}

	// person↔org relations are document-level. `personIds` are published version ids; re-key the
	// relation join through each endpoint's document and resolve the org to its published version.
	const personEntityVersions = alias(schema.entityVersions, "person_entity_versions");
	const organisationalUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"organisational_unit_document_lifecycle",
	);

	const rows = await db
		.select({
			personId: personEntityVersions.id,
			role: schema.personRoleTypes.type,
			name: schema.organisationalUnits.name,
			type: schema.organisationalUnitTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			personEntityVersions,
			eq(personEntityVersions.entityId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.innerJoin(
			organisationalUnitDocumentLifecycle,
			eq(
				organisationalUnitDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, organisationalUnitDocumentLifecycle.publishedId),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.where(
			and(
				inArray(personEntityVersions.id, personIds),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
			),
		);

	const rowsByPerson = new Map<string, Array<PersonPosition>>();

	for (const row of rows) {
		const items = rowsByPerson.get(row.personId) ?? [];
		items.push({ role: row.role, name: row.name, type: row.type });
		rowsByPerson.set(row.personId, items);
	}

	for (const personId of personIds) {
		const personRows = rowsByPerson.get(personId) ?? [];
		const sorted = personRows.toSorted(comparePositions);

		positions.set(personId, sorted.length > 0 ? sorted : null);
	}

	return positions;
}
