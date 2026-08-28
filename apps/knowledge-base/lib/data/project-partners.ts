import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { localeMatch, statusMatch } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import { alias, and, count, desc, eq, sql } from "@/lib/db/sql";

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
	const searchWhere = matchesAllTerms(
		query,
		schema.projects.name,
		schema.projects.acronym,
		schema.projectRoles.role,
		schema.organisationalUnits.name,
		schema.organisationalUnits.acronym,
		schema.organisationalUnitTypes.type,
	);
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
				projectSlug: schema.slugs.value,
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
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.projects.id))
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
	const where = matchesAllTerms(query, schema.projects.name, schema.projects.acronym);
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
	/** True when the project has no version in the selected locale and this fell back to default. */
	projectIsLocaleFallback: boolean;
}

/**
 * `unitDocumentId` is the unit's `entities.id`. Returns every project the unit is/was related to
 * (partner / coordinator / funder), resolving each project to its latest editable version in
 * `localeId` (or the default locale when omitted), falling back to the default locale per-project
 * when a project has no version in `localeId` — the project's name/acronym are translatable. The
 * `projectsToOrganisationalUnits` rows are document-level, so there is a single set per unit
 * document (no draft/published diff).
 */
export async function getUnitProjectPartnerships(
	unitDocumentId: string,
	localeId?: string,
): Promise<Array<UnitProjectPartnership>> {
	const projectSelectedDraft = alias(schema.entityVersions, "unit_project_selected_draft");
	const projectSelectedPublished = alias(schema.entityVersions, "unit_project_selected_published");
	const projectDefaultDraft = alias(schema.entityVersions, "unit_project_default_draft");
	const projectDefaultPublished = alias(schema.entityVersions, "unit_project_default_published");

	const rows = await db
		.select({
			id: schema.projectsToOrganisationalUnits.id,
			projectId: schema.projectsToOrganisationalUnits.projectDocumentId,
			projectName: schema.projects.name,
			projectAcronym: schema.projects.acronym,
			projectSlug: schema.slugs.value,
			roleId: schema.projectsToOrganisationalUnits.roleId,
			roleType: schema.projectRoles.role,
			duration: schema.projectsToOrganisationalUnits.duration,
			projectIsLocaleFallback: sql<boolean>`(${projectSelectedDraft.id} IS NULL AND ${projectSelectedPublished.id} IS NULL)`,
		})
		.from(schema.projectsToOrganisationalUnits)
		.leftJoin(
			projectSelectedDraft,
			and(
				eq(projectSelectedDraft.entityId, schema.projectsToOrganisationalUnits.projectDocumentId),
				localeMatch(projectSelectedDraft.localeId, localeId),
				statusMatch(projectSelectedDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			projectSelectedPublished,
			and(
				eq(
					projectSelectedPublished.entityId,
					schema.projectsToOrganisationalUnits.projectDocumentId,
				),
				localeMatch(projectSelectedPublished.localeId, localeId),
				statusMatch(projectSelectedPublished.statusId, "published"),
			),
		)
		.leftJoin(
			projectDefaultDraft,
			and(
				eq(projectDefaultDraft.entityId, schema.projectsToOrganisationalUnits.projectDocumentId),
				localeMatch(projectDefaultDraft.localeId, undefined),
				statusMatch(projectDefaultDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			projectDefaultPublished,
			and(
				eq(
					projectDefaultPublished.entityId,
					schema.projectsToOrganisationalUnits.projectDocumentId,
				),
				localeMatch(projectDefaultPublished.localeId, undefined),
				statusMatch(projectDefaultPublished.statusId, "published"),
			),
		)
		.innerJoin(
			schema.projects,
			sql`${schema.projects.id} = COALESCE(${projectSelectedDraft.id}, ${projectSelectedPublished.id}, ${projectDefaultDraft.id}, ${projectDefaultPublished.id})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.projects.id))
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
			projectIsLocaleFallback: row.projectIsLocaleFallback,
		};
	});
}

export interface ProjectPartnerUnit {
	id: string;
	unitDocumentId: string;
	unitName: string;
	unitSlug: string;
	unitType: string;
	roleId: string;
	roleName: string;
	duration: { start: Date; end?: Date | null | undefined } | null;
	/** True when the unit has no version in the selected locale and this fell back to default. */
	unitIsLocaleFallback: boolean;
}

/**
 * `projectDocumentId` is the project's `entities.id`. Returns every organisational unit related to
 * the project (partner / coordinator / funder), resolving each unit to its latest editable version
 * in `localeId` (or the default locale when omitted), falling back to the default locale per-unit
 * when a unit has no version in `localeId` — the unit's name/slug are translatable. The
 * `projectsToOrganisationalUnits` rows are document-level, so there is a single set per project
 * document (no draft/published diff).
 */
export async function getProjectPartnerUnits(
	projectDocumentId: string,
	localeId?: string,
): Promise<Array<ProjectPartnerUnit>> {
	const unitSelectedDraft = alias(schema.entityVersions, "project_unit_selected_draft");
	const unitSelectedPublished = alias(schema.entityVersions, "project_unit_selected_published");
	const unitDefaultDraft = alias(schema.entityVersions, "project_unit_default_draft");
	const unitDefaultPublished = alias(schema.entityVersions, "project_unit_default_published");

	const rows = await db
		.select({
			id: schema.projectsToOrganisationalUnits.id,
			unitDocumentId: schema.projectsToOrganisationalUnits.unitDocumentId,
			unitName: schema.organisationalUnits.name,
			unitSlug: schema.slugs.value,
			unitType: schema.organisationalUnitTypes.type,
			roleId: schema.projectsToOrganisationalUnits.roleId,
			roleName: schema.projectRoles.role,
			duration: schema.projectsToOrganisationalUnits.duration,
			unitIsLocaleFallback: sql<boolean>`(${unitSelectedDraft.id} IS NULL AND ${unitSelectedPublished.id} IS NULL)`,
		})
		.from(schema.projectsToOrganisationalUnits)
		.leftJoin(
			unitSelectedDraft,
			and(
				eq(unitSelectedDraft.entityId, schema.projectsToOrganisationalUnits.unitDocumentId),
				localeMatch(unitSelectedDraft.localeId, localeId),
				statusMatch(unitSelectedDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			unitSelectedPublished,
			and(
				eq(unitSelectedPublished.entityId, schema.projectsToOrganisationalUnits.unitDocumentId),
				localeMatch(unitSelectedPublished.localeId, localeId),
				statusMatch(unitSelectedPublished.statusId, "published"),
			),
		)
		.leftJoin(
			unitDefaultDraft,
			and(
				eq(unitDefaultDraft.entityId, schema.projectsToOrganisationalUnits.unitDocumentId),
				localeMatch(unitDefaultDraft.localeId, undefined),
				statusMatch(unitDefaultDraft.statusId, "draft"),
			),
		)
		.leftJoin(
			unitDefaultPublished,
			and(
				eq(unitDefaultPublished.entityId, schema.projectsToOrganisationalUnits.unitDocumentId),
				localeMatch(unitDefaultPublished.localeId, undefined),
				statusMatch(unitDefaultPublished.statusId, "published"),
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${unitSelectedDraft.id}, ${unitSelectedPublished.id}, ${unitDefaultDraft.id}, ${unitDefaultPublished.id})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.projectRoles,
			eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
		)
		.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, projectDocumentId));

	return rows.map((row) => {
		return {
			id: row.id,
			unitDocumentId: row.unitDocumentId,
			unitName: row.unitName,
			unitSlug: row.unitSlug,
			unitType: row.unitType,
			roleId: row.roleId,
			roleName: row.roleName,
			duration: row.duration ?? null,
			unitIsLocaleFallback: row.unitIsLocaleFallback,
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
