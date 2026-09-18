import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { localeMatch, statusMatch } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { alias, and, count, desc, eq, sql } from "@/lib/db/sql";

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

export type ProjectAffiliationsSort =
	| "projectName"
	| "personName"
	| "durationStart"
	| "durationEnd";

interface GetProjectAffiliationsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ProjectAffiliationsSort;
	dir?: "asc" | "desc";
}

export interface ProjectAffiliationsResult {
	data: Array<{
		id: string;
		projectId: string;
		projectAcronym: string | null;
		projectName: string;
		projectSlug: string;
		personDocumentId: string;
		personName: string;
		durationStart: Date | undefined;
		durationEnd: Date | undefined;
	}>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

/**
 * Admin-facing, cross-project list of `projects_to_persons` affiliations — mirrors
 * `getProjectPartners` for `projects_to_organisational_units`. Each side resolves to its latest
 * editable version (draft-or-published), so an admin can manage a relation before either side is
 * published.
 */
export async function getProjectAffiliations(
	params: Readonly<GetProjectAffiliationsParams>,
): Promise<ProjectAffiliationsResult> {
	const { limit, offset, q, sort = "projectName", dir = "asc" } = params;
	const projectEntities = alias(schema.entities, "affiliation_project_entities");
	const projectDocumentLifecycle = alias(
		schema.documentLifecycle,
		"affiliation_project_document_lifecycle",
	);
	const personDocumentLifecycle = alias(
		schema.documentLifecycle,
		"affiliation_person_document_lifecycle",
	);
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;
	const personPickedVersion = sql`COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`;
	const query = q?.trim();
	const where = matchesAllTerms(
		query,
		schema.projects.name,
		schema.projects.acronym,
		schema.persons.name,
	);
	const orderBy =
		sort === "personName"
			? dir === "asc"
				? schema.persons.name
				: desc(schema.persons.name)
			: sort === "durationStart"
				? dir === "asc"
					? sql`LOWER(${schema.projectsToPersons.duration}) ASC NULLS LAST`
					: sql`LOWER(${schema.projectsToPersons.duration}) DESC NULLS LAST`
				: sort === "durationEnd"
					? dir === "asc"
						? sql`UPPER(${schema.projectsToPersons.duration}) ASC NULLS LAST`
						: sql`UPPER(${schema.projectsToPersons.duration}) DESC NULLS LAST`
					: dir === "asc"
						? schema.projects.name
						: desc(schema.projects.name);

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.projectsToPersons.id,
				projectId: schema.projectsToPersons.projectDocumentId,
				projectAcronym: schema.projects.acronym,
				projectName: schema.projects.name,
				projectSlug: schema.slugs.value,
				personDocumentId: schema.projectsToPersons.personDocumentId,
				personName: schema.persons.name,
				duration: schema.projectsToPersons.duration,
			})
			.from(schema.projectsToPersons)
			.innerJoin(
				projectEntities,
				eq(projectEntities.id, schema.projectsToPersons.projectDocumentId),
			)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.projects.id))
			.innerJoin(
				personDocumentLifecycle,
				eq(personDocumentLifecycle.documentId, schema.projectsToPersons.personDocumentId),
			)
			.innerJoin(schema.persons, sql`${schema.persons.id} = ${personPickedVersion}`)
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.projectsToPersons)
			.innerJoin(
				projectEntities,
				eq(projectEntities.id, schema.projectsToPersons.projectDocumentId),
			)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.innerJoin(
				personDocumentLifecycle,
				eq(personDocumentLifecycle.documentId, schema.projectsToPersons.personDocumentId),
			)
			.innerJoin(schema.persons, sql`${schema.persons.id} = ${personPickedVersion}`)
			.where(where),
	]);

	return {
		data: rows.map((row) => {
			return {
				id: row.id,
				projectId: row.projectId,
				projectAcronym: row.projectAcronym,
				projectName: row.projectName,
				projectSlug: row.projectSlug,
				personDocumentId: row.personDocumentId,
				personName: row.personName,
				durationStart: row.duration?.start,
				durationEnd: row.duration?.end,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getProjectAffiliationsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetProjectAffiliationsParams>,
): Promise<ProjectAffiliationsResult> {
	assertAdminUser(currentUser);

	return getProjectAffiliations(params);
}
