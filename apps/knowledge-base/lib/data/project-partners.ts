import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, count, desc, eq, or, sql } from "@/lib/db/sql";

export type ProjectPartnersSort =
	| "projectName"
	| "roleType"
	| "unitName"
	| "unitType"
	| "durationStart"
	| "durationEnd";

interface GetProjectPartnersParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ProjectPartnersSort;
	dir?: "asc" | "desc";
}

export interface ProjectPartnersResult {
	data: Array<{
		id: string;
		projectId: string;
		projectAcronym: string | null;
		projectName: string;
		projectSlug: string;
		roleId: string;
		roleType: string;
		unitDocumentId: string;
		unitName: string;
		unitType: string;
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

export async function getProjectPartners(
	params: Readonly<GetProjectPartnersParams>,
): Promise<ProjectPartnersResult> {
	const { limit, offset, q, sort = "projectName", dir = "asc" } = params;
	// projectDocumentId / unitDocumentId are document ids; resolve each to its latest editable version.
	const projectEntities = alias(schema.entities, "project_entities");
	const projectDocumentLifecycle = alias(schema.documentLifecycle, "project_document_lifecycle");
	const unitDocumentLifecycle = alias(schema.documentLifecycle, "unit_document_lifecycle");
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;
	const unitPickedVersion = sql`COALESCE(${unitDocumentLifecycle.draftId}, ${unitDocumentLifecycle.publishedId})`;
	const query = q?.trim();
	const searchWhere =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.projects.name, `%${query}%`),
					unaccentIlike(schema.projects.acronym, `%${query}%`),
					unaccentIlike(schema.projectRoles.role, `%${query}%`),
					unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
					unaccentIlike(schema.organisationalUnitTypes.type, `%${query}%`),
				)
			: undefined;
	const where = searchWhere;
	const orderBy =
		sort === "roleType"
			? dir === "asc"
				? schema.projectRoles.role
				: desc(schema.projectRoles.role)
			: sort === "unitName"
				? dir === "asc"
					? schema.organisationalUnits.name
					: desc(schema.organisationalUnits.name)
				: sort === "unitType"
					? dir === "asc"
						? schema.organisationalUnitTypes.type
						: desc(schema.organisationalUnitTypes.type)
					: sort === "durationStart"
						? dir === "asc"
							? sql`LOWER(${schema.projectsToOrganisationalUnits.duration}) ASC NULLS LAST`
							: sql`LOWER(${schema.projectsToOrganisationalUnits.duration}) DESC NULLS LAST`
						: sort === "durationEnd"
							? dir === "asc"
								? sql`UPPER(${schema.projectsToOrganisationalUnits.duration}) ASC NULLS LAST`
								: sql`UPPER(${schema.projectsToOrganisationalUnits.duration}) DESC NULLS LAST`
							: dir === "asc"
								? schema.projects.name
								: desc(schema.projects.name);

	const [rows, aggregate] = await Promise.all([
		db
			.select({
				id: schema.projectsToOrganisationalUnits.id,
				projectId: schema.projectsToOrganisationalUnits.projectDocumentId,
				projectAcronym: schema.projects.acronym,
				projectName: schema.projects.name,
				projectSlug: projectEntities.slug,
				roleId: schema.projectsToOrganisationalUnits.roleId,
				roleType: schema.projectRoles.role,
				unitDocumentId: schema.projectsToOrganisationalUnits.unitDocumentId,
				unitName: schema.organisationalUnits.name,
				unitType: schema.organisationalUnitTypes.type,
				duration: schema.projectsToOrganisationalUnits.duration,
			})
			.from(schema.projectsToOrganisationalUnits)
			.innerJoin(
				projectEntities,
				eq(projectEntities.id, schema.projectsToOrganisationalUnits.projectDocumentId),
			)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.innerJoin(
				schema.projectRoles,
				eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
			)
			.innerJoin(
				unitDocumentLifecycle,
				eq(unitDocumentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${unitPickedVersion}`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(where)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.projectsToOrganisationalUnits)
			.innerJoin(
				projectEntities,
				eq(projectEntities.id, schema.projectsToOrganisationalUnits.projectDocumentId),
			)
			.innerJoin(
				projectDocumentLifecycle,
				eq(projectDocumentLifecycle.documentId, projectEntities.id),
			)
			.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
			.innerJoin(
				schema.projectRoles,
				eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
			)
			.innerJoin(
				unitDocumentLifecycle,
				eq(unitDocumentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = ${unitPickedVersion}`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
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
				unitDocumentId: row.unitDocumentId,
				unitName: row.unitName,
				unitType: row.unitType,
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

export interface UnitProjectPartnership {
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
 * `unitDocumentId` is the unit's `entities.id`. Returns every project the unit is/was related to
 * (partner / coordinator / funder), resolving each project to its latest editable version. The
 * `projectsToOrganisationalUnits` rows are document-level, so there is a single set per unit
 * document (no draft/published diff).
 */
export async function getUnitProjectPartnerships(
	unitDocumentId: string,
): Promise<Array<UnitProjectPartnership>> {
	const projectEntities = alias(schema.entities, "unit_project_entities");
	const projectDocumentLifecycle = alias(
		schema.documentLifecycle,
		"unit_project_document_lifecycle",
	);
	const projectPickedVersion = sql`COALESCE(${projectDocumentLifecycle.draftId}, ${projectDocumentLifecycle.publishedId})`;

	const rows = await db
		.select({
			id: schema.projectsToOrganisationalUnits.id,
			projectId: schema.projectsToOrganisationalUnits.projectDocumentId,
			projectName: schema.projects.name,
			projectAcronym: schema.projects.acronym,
			projectSlug: projectEntities.slug,
			roleId: schema.projectsToOrganisationalUnits.roleId,
			roleType: schema.projectRoles.role,
			duration: schema.projectsToOrganisationalUnits.duration,
		})
		.from(schema.projectsToOrganisationalUnits)
		.innerJoin(
			projectEntities,
			eq(projectEntities.id, schema.projectsToOrganisationalUnits.projectDocumentId),
		)
		.innerJoin(
			projectDocumentLifecycle,
			eq(projectDocumentLifecycle.documentId, projectEntities.id),
		)
		.innerJoin(schema.projects, sql`${schema.projects.id} = ${projectPickedVersion}`)
		.innerJoin(
			schema.projectRoles,
			eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
		)
		.where(eq(schema.projectsToOrganisationalUnits.unitDocumentId, unitDocumentId))
		.orderBy(
			sql`UPPER(${schema.projectsToOrganisationalUnits.duration}) DESC NULLS FIRST`,
			sql`LOWER(${schema.projectsToOrganisationalUnits.duration}) DESC`,
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

export async function getProjectPartnersForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetProjectPartnersParams>,
): Promise<ProjectPartnersResult> {
	assertAdminUser(currentUser);

	return getProjectPartners(params);
}
