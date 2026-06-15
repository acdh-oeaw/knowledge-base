import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, count, desc, eq, or, sql } from "@/lib/db/sql";

export type GovernanceBodiesSort = "acronym" | "name";

interface GetGovernanceBodiesParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: GovernanceBodiesSort;
	dir?: "asc" | "desc";
}

export interface GovernanceBodiesResult {
	data: Array<
		Pick<schema.OrganisationalUnit, "acronym" | "id" | "name"> & {
			documentId: string;
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

export async function getGovernanceBodies(
	params: Readonly<GetGovernanceBodiesParams>,
): Promise<GovernanceBodiesResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const governanceBodyType =
		"governance_body" as typeof schema.organisationalUnitTypes.$inferSelect.type;
	const where =
		query != null && query !== ""
			? and(
					eq(schema.organisationalUnitTypes.type, governanceBodyType),
					or(
						unaccentIlike(schema.organisationalUnits.acronym, `%${query}%`),
						unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
					),
				)
			: eq(schema.organisationalUnitTypes.type, governanceBodyType);

	const orderBy =
		sort === "acronym"
			? dir === "asc"
				? sql`${schema.organisationalUnits.acronym} ASC NULLS LAST`
				: sql`${schema.organisationalUnits.acronym} DESC NULLS LAST`
			: dir === "asc"
				? schema.organisationalUnits.name
				: desc(schema.organisationalUnits.name);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
	const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				acronym: schema.organisationalUnits.acronym,
				documentId: schema.entities.id,
				id: schema.organisationalUnits.id,
				name: schema.organisationalUnits.name,
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
	]);

	return {
		data: items.map((item) => {
			return {
				acronym: item.acronym,
				documentId: item.documentId,
				entity: { slug: item.slug },
				hasDraft: item.hasDraft,
				id: item.id,
				isPublished: item.isPublished,
				name: item.name,
				updatedAt: item.updatedAt,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getGovernanceBodiesForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetGovernanceBodiesParams>,
): Promise<GovernanceBodiesResult> {
	assertAdminUser(currentUser);

	return getGovernanceBodies(params);
}
