/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { alias, and, eq, sql } from "@/lib/db/sql";

/**
 * `unitDocumentId` is the working group's `entities.id`. Each chair person is resolved to its
 * latest editable version for display.
 */
export async function getWorkingGroupChairs(unitDocumentId: string) {
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");

	return db
		.select({
			id: schema.personsToOrganisationalUnits.id,
			personId: schema.personsToOrganisationalUnits.personDocumentId,
			personName: schema.persons.name,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			personDocumentLifecycle,
			eq(personDocumentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, unitDocumentId),
				eq(schema.personRoleTypes.type, "is_chair_of"),
			),
		);
}

export type WorkingGroupChair = Awaited<ReturnType<typeof getWorkingGroupChairs>>[number];
