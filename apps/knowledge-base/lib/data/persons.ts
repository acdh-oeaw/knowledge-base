import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, count, desc, eq, sql } from "@/lib/db/sql";

export type PersonsSort = "name" | "email" | "orcid";

interface GetPersonsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: PersonsSort;
	dir?: "asc" | "desc";
}

export interface PersonsResult {
	data: Array<
		Pick<schema.Person, "email" | "id" | "name" | "orcid"> & {
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

export async function getPersons(params: Readonly<GetPersonsParams>): Promise<PersonsResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const where =
		query != null && query !== "" ? unaccentIlike(schema.persons.name, `%${query}%`) : undefined;
	const orderBy =
		sort === "email"
			? dir === "asc"
				? sql`${schema.persons.email} ASC NULLS LAST`
				: sql`${schema.persons.email} DESC NULLS LAST`
			: sort === "orcid"
				? dir === "asc"
					? sql`${schema.persons.orcid} ASC NULLS LAST`
					: sql`${schema.persons.orcid} DESC NULLS LAST`
				: dir === "asc"
					? schema.persons.sortName
					: desc(schema.persons.sortName);

	const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
	const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

	const [data, aggregate] = await Promise.all([
		db
			.select({
				documentId: schema.entities.id,
				email: schema.persons.email,
				id: schema.persons.id,
				name: schema.persons.name,
				orcid: schema.persons.orcid,
				slug: schema.entities.slug,
				updatedAt: schema.entityVersions.updatedAt,
				isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
				hasDraft: schema.documentLifecycle.hasDraftChanges,
				status: schema.entityStatus.type,
			})
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
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
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
			)
			.where(and(versionPick, where)),
	]);

	return {
		data: data.map((item) => {
			return {
				documentId: item.documentId,
				email: item.email,
				entity: { slug: item.slug },
				hasDraft: item.hasDraft,
				id: item.id,
				isPublished: item.isPublished,
				name: item.name,
				orcid: item.orcid,
				updatedAt: item.updatedAt,
			};
		}),
		limit,
		offset,
		total: aggregate.at(0)?.total ?? 0,
	};
}

export async function getPersonsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetPersonsParams>,
): Promise<PersonsResult> {
	assertAdminUser(currentUser);

	return getPersons(params);
}
