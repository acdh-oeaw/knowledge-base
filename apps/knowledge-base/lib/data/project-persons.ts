import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, count, desc, eq, or, sql } from "@/lib/db/sql";

export type ProjectPersonsSort =
	| "projectName"
	| "roleType"
	| "personName"
	| "durationStart"
	| "durationEnd";

interface GetProjectPersonsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ProjectPersonsSort;
	dir?: "asc" | "desc";
}

export interface ProjectPersonsResult {
	data: Array<{
		id: string;
		projectId: string;
		projectAcronym: string | null;
		projectName: string;
		projectSlug: string;
		roleId: string;
		roleType: string;
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

export async function getProjectPersons(
	params: Readonly<GetProjectPersonsParams>,
): Promise<ProjectPersonsResult> {
	const { limit, offset, q, sort = "projectName", dir = "asc" } = params;
	// projectDocumentId / personDocumentId are document ids; resolve each to its latest editable version.
	const projectEntities = alias(schema.entities, "project_entities");
	const projectDocumentLifecycle = alias(schema.documentLifecycle, "project_document_lifecycle");
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;
	const personPickedVersion = sql`COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`;
	const query = q?.trim();
	const searchWhere =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.projects.name, `%${query}%`),
					unaccentIlike(schema.projects.acronym, `%${query}%`),
					unaccentIlike(schema.projectRoles.role, `%${query}%`),
					unaccentIlike(schema.persons.name, `%${query}%`),
				)
			: undefined;
	const where = searchWhere;
	const orderBy =
		sort === "roleType"
			? dir === "asc"
				? schema.projectRoles.role
				: desc(schema.projectRoles.role)
			: sort === "personName"
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
				projectSlug: projectEntities.slug,
				roleId: schema.projectsToPersons.roleId,
				roleType: schema.projectRoles.role,
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
			.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
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
			.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
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
				roleId: row.roleId,
				roleType: row.roleType,
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

interface GetProjectOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getProjectOptions(params: Readonly<GetProjectOptionsParams> = {}): Promise<{
	items: Array<{ id: string; name: string; description: string | undefined }>;
	total: number;
}> {
	const { limit = 20, offset = 0, q } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.projects.name, `%${query}%`),
					unaccentIlike(schema.projects.acronym, `%${query}%`),
				)
			: undefined;
	const projectEntities = alias(schema.entities, "project_option_entities");
	const projectDocumentLifecycle = alias(
		schema.documentLifecycle,
		"project_option_document_lifecycle",
	);
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: projectEntities.id,
				name: schema.projects.name,
				acronym: schema.projects.acronym,
			})
			.from(projectEntities)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.where(where)
			.orderBy(schema.projects.name)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(projectEntities)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.where(where),
	]);

	return {
		items: items.map((item) => {
			return {
				id: item.id,
				name: item.acronym ?? item.name,
				description: item.acronym != null ? item.name : undefined,
			};
		}),
		total: aggregate.at(0)?.total ?? 0,
	};
}

export interface PersonProjectRelation {
	id: string;
	projectId: string;
	projectName: string;
	projectAcronym: string | null;
	projectSlug: string;
	roleId: string;
	roleType: string;
	duration: { start: Date; end?: Date | null | undefined } | null;
}

/**
 * `personDocumentId` is the persons's `entities.id`. Returns every project the person is/was
 * related to (partner / coordinator / funder), resolving each project to its latest editable
 * version. The `projectsToPersons` rows are document-level, so there is a single set per person
 * document (no draft/published diff).
 */
export async function getPersonProjectPerson(
	personDocumentId: string,
): Promise<Array<PersonProjectRelation>> {
	const projectEntities = alias(schema.entities, "person_project_entities");
	const projectDocumentLifecycle = alias(
		schema.documentLifecycle,
		"person_project_document_lifecycle",
	);
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;

	const rows = await db
		.select({
			id: schema.projectsToPersons.id,
			projectId: schema.projectsToPersons.projectDocumentId,
			projectName: schema.projects.name,
			projectAcronym: schema.projects.acronym,
			projectSlug: projectEntities.slug,
			roleId: schema.projectsToPersons.roleId,
			roleType: schema.projectRoles.role,
			duration: schema.projectsToPersons.duration,
		})
		.from(schema.projectsToPersons)
		.innerJoin(projectEntities, eq(projectEntities.id, schema.projectsToPersons.projectDocumentId))
		.innerJoin(
			projectDocumentLifecycle,
			eq(projectDocumentLifecycle.documentId, projectEntities.id),
		)
		.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
		.innerJoin(schema.projectRoles, eq(schema.projectRoles.id, schema.projectsToPersons.roleId))
		.where(eq(schema.projectsToPersons.personDocumentId, personDocumentId))
		.orderBy(
			sql`UPPER(${schema.projectsToPersons.duration}) DESC NULLS FIRST`,
			sql`LOWER(${schema.projectsToPersons.duration}) DESC`,
			schema.projects.name,
		);

	return rows.map((row) => {
		return {
			id: row.id,
			projectId: row.projectId,
			projectName: row.projectName,
			projectAcronym: row.projectAcronym,
			projectSlug: row.projectSlug,
			roleId: row.roleId,
			roleType: row.roleType,
			duration: row.duration ?? null,
		};
	});
}

export async function getProjectPersonsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetProjectPersonsParams>,
): Promise<ProjectPersonsResult> {
	assertAdminUser(currentUser);

	return getProjectPersons(params);
}
