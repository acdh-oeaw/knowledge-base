/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { getSocialMediaOptions, getSocialMediaOptionsByIds } from "@/lib/data/social-media";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, desc, eq, or, sql } from "@/lib/db/sql";

export type ProjectsSort = "name" | "acronym" | "funding" | "scope";

interface GetProjectsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: ProjectsSort;
	dir?: "asc" | "desc";
}

export interface ProjectsResult {
	data: Array<
		Pick<schema.Project, "acronym" | "duration" | "funding" | "id" | "name"> & {
			documentId: string;
			entity: Pick<schema.Entity, "slug">;
			hasDraft: boolean;
			isPublished: boolean;
			scope: Pick<schema.ProjectScope, "id" | "scope">;
			updatedAt: Date;
		}
	>;
	limit: number;
	offset: number;
	total: number;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export async function getProjects(params: Readonly<GetProjectsParams>): Promise<ProjectsResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? or(
					unaccentIlike(schema.projects.name, `%${query}%`),
					unaccentIlike(schema.projects.acronym, `%${query}%`),
				)
			: undefined;
	const orderBy =
		sort === "acronym"
			? dir === "asc"
				? sql`${schema.projects.acronym} ASC NULLS LAST`
				: sql`${schema.projects.acronym} DESC NULLS LAST`
			: sort === "funding"
				? dir === "asc"
					? sql`${schema.projects.funding} ASC NULLS LAST`
					: sql`${schema.projects.funding} DESC NULLS LAST`
				: sort === "scope"
					? dir === "asc"
						? schema.projectScopes.scope
						: desc(schema.projectScopes.scope)
					: dir === "asc"
						? schema.projects.name
						: desc(schema.projects.name);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
	const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

	const [data, aggregate] = await Promise.all([
		db
			.select({
				acronym: schema.projects.acronym,
				documentId: schema.entities.id,
				duration: schema.projects.duration,
				funding: schema.projects.funding,
				updatedAt: schema.entityVersions.updatedAt,
				id: schema.projects.id,
				name: schema.projects.name,
				scope: schema.projectScopes.scope,
				scopeId: schema.projectScopes.id,
				slug: schema.entities.slug,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
			})
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(schema.projectScopes, eq(schema.projects.scopeId, schema.projectScopes.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.where(and(versionPick, where))
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.projects)
			.innerJoin(schema.entityVersions, eq(schema.projects.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(versionPick, where)),
	]);

	return {
		data: data.map((item) => {
			return {
				acronym: item.acronym,
				documentId: item.documentId,
				duration: item.duration,
				entity: { slug: item.slug },
				funding: item.funding,
				hasDraft: item.hasDraft,
				id: item.id,
				isPublished: item.isPublished,
				name: item.name,
				updatedAt: item.updatedAt,
				scope: {
					id: item.scopeId,
					scope: item.scope,
				},
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getProjectsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetProjectsParams>,
): Promise<ProjectsResult> {
	assertAdminUser(currentUser);

	return getProjects(params);
}

export async function getProjectCreateDataForAdmin(currentUser: Pick<User, "role">) {
	assertAdminUser(currentUser);

	const [scopes, roles, initialSocialMedia] = await Promise.all([
		db.query.projectScopes.findMany({
			orderBy: {
				scope: "asc",
			},
			columns: {
				id: true,
				scope: true,
			},
		}),
		db.query.projectRoles.findMany({
			orderBy: { role: "asc" },
			columns: { id: true, role: true },
		}),
		getSocialMediaOptions(),
	]);

	return { initialSocialMedia, roles, scopes };
}

export async function getProjectBySlugForAdmin(currentUser: Pick<User, "role">, slug: string) {
	assertAdminUser(currentUser);

	return db.query.projects.findFirst({
		where: {
			entityVersion: {
				entity: {
					slug,
				},
			},
		},
		columns: {
			acronym: true,
			call: true,
			duration: true,
			funding: true,
			id: true,
			name: true,
			summary: true,
			topic: true,
		},
		with: {
			entityVersion: {
				columns: { id: true },
				with: {
					entity: {
						columns: {
							id: true,
							slug: true,
						},
					},
					status: {
						columns: {
							id: true,
							type: true,
						},
					},
				},
			},
			image: {
				columns: {
					key: true,
					label: true,
				},
			},
			scope: {
				columns: {
					id: true,
					scope: true,
				},
			},
		},
	});
}

/**
 * Project partner rows (project↔org-unit relations) for a single project, for the admin surfaces.
 * Each partner's unit is resolved to its published version: a partner is only ever created against
 * a published unit and that published version is never removed without deleting the whole document
 * (which also removes the partner row), so `publishedId` is always present here.
 */
function getProjectPartnerRowsForAdmin(projectDocumentId: string) {
	const unitDocumentLifecycle = alias(schema.documentLifecycle, "unit_document_lifecycle");
	return db
		.select({
			id: schema.projectsToOrganisationalUnits.id,
			unitDocumentId: schema.projectsToOrganisationalUnits.unitDocumentId,
			unitName: schema.organisationalUnits.name,
			roleId: schema.projectsToOrganisationalUnits.roleId,
			roleName: schema.projectRoles.role,
			duration: schema.projectsToOrganisationalUnits.duration,
		})
		.from(schema.projectsToOrganisationalUnits)
		.innerJoin(
			unitDocumentLifecycle,
			eq(unitDocumentLifecycle.documentId, schema.projectsToOrganisationalUnits.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, unitDocumentLifecycle.publishedId),
		)
		.innerJoin(
			schema.projectRoles,
			eq(schema.projectRoles.id, schema.projectsToOrganisationalUnits.roleId),
		)
		.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, projectDocumentId));
}

export async function getProjectDetailsForAdmin(currentUser: Pick<User, "role">, slug: string) {
	assertAdminUser(currentUser);

	const project = await getProjectBySlugForAdmin(currentUser, slug);

	if (project == null) {
		return null;
	}

	const [descriptionRows, partners, socialMediaLinks] = await Promise.all([
		db
			.select({ content: schema.richTextContentBlocks.content })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, project.id),
					eq(schema.entityTypesFieldsNames.fieldName, "description"),
				),
			)
			.limit(1),
		getProjectPartnerRowsForAdmin(project.entityVersion.entity.id),
		db.query.projectsToSocialMedia.findMany({
			where: { projectId: project.id },
			columns: {},
			with: {
				socialMedia: {
					columns: { id: true, name: true, url: true },
					with: { type: { columns: { type: true } } },
				},
			},
		}),
	]);

	return {
		description: descriptionRows.at(0)?.content ?? null,
		partners: partners.map((partner) => {
			return {
				id: partner.id,
				unitName: partner.unitName,
				roleName: partner.roleName,
				duration: partner.duration ?? null,
			};
		}),
		project,
		socialMedia: socialMediaLinks.map((link) => link.socialMedia),
	};
}

export async function getProjectEditDataForAdmin(currentUser: Pick<User, "role">, slug: string) {
	assertAdminUser(currentUser);

	const project = await getProjectBySlugForAdmin(currentUser, slug);

	if (project == null) {
		return null;
	}

	const [
		descriptionRows,
		scopes,
		roles,
		initialSocialMedia,
		existingPartners,
		existingSocialMedia,
	] = await Promise.all([
		db
			.select({ content: schema.richTextContentBlocks.content })
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(
				and(
					eq(schema.fields.entityVersionId, project.id),
					eq(schema.entityTypesFieldsNames.fieldName, "description"),
				),
			)
			.limit(1),
		db.query.projectScopes.findMany({
			orderBy: { scope: "asc" },
			columns: { id: true, scope: true },
		}),
		db.query.projectRoles.findMany({
			orderBy: { role: "asc" },
			columns: { id: true, role: true },
		}),
		getSocialMediaOptions(),
		getProjectPartnerRowsForAdmin(project.entityVersion.entity.id),
		db.query.projectsToSocialMedia.findMany({
			where: { projectId: project.id },
			columns: { socialMediaId: true },
		}),
	]);

	const initialPartners = existingPartners.map((partner) => {
		return {
			id: partner.id,
			unitDocumentId: partner.unitDocumentId,
			unitName: partner.unitName,
			roleId: partner.roleId,
			roleName: partner.roleName,
			durationStart:
				partner.duration?.start != null ? partner.duration.start.toISOString().slice(0, 10) : null,
			durationEnd:
				partner.duration?.end != null ? partner.duration.end.toISOString().slice(0, 10) : null,
		};
	});

	const initialSocialMediaIds = existingSocialMedia.map((row) => row.socialMediaId);

	const selectedSocialMediaItems = await getSocialMediaOptionsByIds(initialSocialMediaIds);

	return {
		description: descriptionRows.at(0)?.content,
		initialPartners,
		initialSocialMedia,
		initialSocialMediaIds,
		project,
		roles,
		scopes,
		selectedSocialMediaItems,
	};
}
