import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, desc, eq, inArray, or, sql } from "@/lib/db/sql";

export type WorkingGroupsSort = "name";

interface GetWorkingGroupsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: WorkingGroupsSort;
	dir?: "asc" | "desc";
}

export interface WorkingGroupsResult {
	data: Array<
		Pick<schema.OrganisationalUnit, "acronym" | "id" | "name" | "sshocMarketplaceActorId"> & {
			documentId: string;
			durationFrom: Date | null;
			durationUntil: Date | null;
			entity: Pick<schema.Entity, "slug">;
			hasDraft: boolean;
			isPublished: boolean;
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

const dariahEuSlug = "dariah-eu";

export async function getWorkingGroups(
	params: Readonly<GetWorkingGroupsParams>,
): Promise<WorkingGroupsResult> {
	const { limit, offset, q, dir = "asc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? and(
					eq(
						schema.organisationalUnitTypes.type,
						"working_group" as typeof schema.organisationalUnitTypes.$inferSelect.type,
					),
					or(
						unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
						unaccentIlike(schema.organisationalUnits.acronym, `%${query}%`),
					),
				)
			: eq(
					schema.organisationalUnitTypes.type,
					"working_group" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				);

	const orderBy =
		dir === "desc" ? desc(schema.organisationalUnits.name) : schema.organisationalUnits.name;

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
	const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

	const [items, aggregate, erics] = await Promise.all([
		db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entities.id,
				id: schema.organisationalUnits.id,
				name: schema.organisationalUnits.name,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				slug: schema.entities.slug,
				updatedAt: schema.entityVersions.updatedAt,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
			})
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
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
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(versionPick, where)),
		db.query.organisationalUnits.findMany({
			where: { entityVersion: { entity: { slug: dariahEuSlug } }, type: { type: "eric" } },
			columns: { id: true },
		}),
	]);

	const workingGroupIds = items.map((item) => item.id);
	const ericIds = erics.map((eric) => eric.id);

	let relationByWorkingGroupId = new Map<string, { from: Date; until: Date | null }>();

	if (workingGroupIds.length > 0 && ericIds.length > 0) {
		// Unit↔unit relations are document-level; re-key through entity_versions so the result keeps the
		// working-group *version* ids the caller passed in.
		const wgVersions = alias(schema.entityVersions, "wg_versions");
		const ericVersions = alias(schema.entityVersions, "eric_versions");
		const relations = await db
			.select({
				duration: schema.organisationalUnitsRelations.duration,
				unitId: wgVersions.id,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				wgVersions,
				eq(wgVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
			)
			.innerJoin(
				ericVersions,
				eq(ericVersions.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.where(
				and(
					inArray(wgVersions.id, workingGroupIds),
					inArray(ericVersions.id, ericIds),
					eq(schema.organisationalUnitStatus.status, "is_part_of"),
				),
			);

		relationByWorkingGroupId = new Map();

		for (const relation of relations) {
			const existing = relationByWorkingGroupId.get(relation.unitId);
			const nextRelation = {
				from: relation.duration.start,
				until: relation.duration.end ?? null,
			};

			if (existing == null) {
				relationByWorkingGroupId.set(relation.unitId, nextRelation);
				continue;
			}

			const shouldReplace =
				(existing.until != null && nextRelation.until == null) || nextRelation.from > existing.from;

			if (shouldReplace) {
				relationByWorkingGroupId.set(relation.unitId, nextRelation);
			}
		}
	}

	return {
		data: items.map((item) => {
			const relation = relationByWorkingGroupId.get(item.id);

			return {
				documentId: item.documentId,
				durationFrom: relation?.from ?? null,
				durationUntil: relation?.until ?? null,
				entity: { slug: item.slug },
				hasDraft: item.hasDraft,
				acronym: item.acronym,
				id: item.id,
				isPublished: item.isPublished,
				name: item.name,
				sshocMarketplaceActorId: item.sshocMarketplaceActorId,
				updatedAt: item.updatedAt,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getWorkingGroupsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetWorkingGroupsParams>,
): Promise<WorkingGroupsResult> {
	assertAdminUser(currentUser);

	return getWorkingGroups(params);
}
