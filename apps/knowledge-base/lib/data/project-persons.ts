import * as schema from "@dariah-eric/database/schema";

import { localeMatch, statusMatch } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { alias, and, eq, sql } from "@/lib/db/sql";

export interface ProjectAffiliatedPerson {
	id: string;
	personDocumentId: string;
	personName: string;
	personSlug: string;
	roleId: string;
	roleName: string;
	duration: { start: Date; end?: Date | null | undefined } | null;
	/** True when the person has no version in the selected locale and this fell back to default. */
	personIsLocaleFallback: boolean;
}

/**
 * `projectDocumentId` is the project's `entities.id`. Returns every person affiliated with the
 * project, resolving each person to its latest editable version in `localeId` (or the default
 * locale when omitted), falling back to the default locale per-person when a person has no version
 * in `localeId` — a person's name is translatable. `projectsToPersons` rows are document-level, so
 * there is a single set per project document (no draft/published diff), mirroring
 * `getProjectPartnerUnits` for `projectsToOrganisationalUnits`.
 */
export async function getProjectAffiliatedPersons(
	projectDocumentId: string,
	localeId?: string,
): Promise<Array<ProjectAffiliatedPerson>> {
	const personSelectedDraft = alias(schema.entityVersions, "project_person_selected_draft");
	const personSelectedPublished = alias(schema.entityVersions, "project_person_selected_published");
	const personDefaultDraft = alias(schema.entityVersions, "project_person_default_draft");
	const personDefaultPublished = alias(schema.entityVersions, "project_person_default_published");

	const rows = await db
		.select({
			id: schema.projectsToPersons.id,
			personDocumentId: schema.projectsToPersons.personDocumentId,
			personName: schema.persons.name,
			personSlug: schema.slugs.value,
			roleId: schema.projectsToPersons.roleId,
			roleName: schema.projectRoles.role,
			duration: schema.projectsToPersons.duration,
			personIsLocaleFallback: sql<boolean>`(${personSelectedDraft.id} IS NULL AND ${personSelectedPublished.id} IS NULL)`,
		})
		.from(schema.projectsToPersons)
		.leftJoin(
			personSelectedDraft,
			and(
				eq(personSelectedDraft.entityId, schema.projectsToPersons.personDocumentId),
				localeMatch(personSelectedDraft.localeId, localeId),
				statusMatch(personSelectedDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			personSelectedPublished,
			and(
				eq(personSelectedPublished.entityId, schema.projectsToPersons.personDocumentId),
				localeMatch(personSelectedPublished.localeId, localeId),
				statusMatch(personSelectedPublished.statusId, "published"),
			),
		)
		.leftJoin(
			personDefaultDraft,
			and(
				eq(personDefaultDraft.entityId, schema.projectsToPersons.personDocumentId),
				localeMatch(personDefaultDraft.localeId, undefined),
				statusMatch(personDefaultDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			personDefaultPublished,
			and(
				eq(personDefaultPublished.entityId, schema.projectsToPersons.personDocumentId),
				localeMatch(personDefaultPublished.localeId, undefined),
				statusMatch(personDefaultPublished.statusId, "published"),
			),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personSelectedDraft.id}, ${personSelectedPublished.id}, ${personDefaultDraft.id}, ${personDefaultPublished.id})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.persons.id))
		.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
		.where(eq(schema.projectsToPersons.projectDocumentId, projectDocumentId))
		.orderBy(
			sql`UPPER(${schema.projectsToPersons.duration}) DESC NULLS FIRST`,
			sql`LOWER(${schema.projectsToPersons.duration}) DESC`,
			schema.persons.name,
		);

	return rows.map((row) => {
		return {
			id: row.id,
			personDocumentId: row.personDocumentId,
			personName: row.personName,
			personSlug: row.personSlug,
			roleId: row.roleId,
			roleName: row.roleName,
			duration: row.duration ?? null,
			personIsLocaleFallback: row.personIsLocaleFallback,
		};
	});
}
