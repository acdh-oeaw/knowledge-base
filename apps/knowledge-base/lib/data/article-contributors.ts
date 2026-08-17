/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { relationOptionsPageSize } from "@/lib/constants/relations";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, count, eq, inArray, sql } from "@/lib/db/sql";

export interface PersonOption {
	id: string;
	name: string;
}

interface GetPersonOptionsParams {
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getPersonOptions(
	params: GetPersonOptionsParams = {},
): Promise<{ items: Array<PersonOption>; total: number }> {
	const { limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();
	const searchWhere =
		query != null && query !== "" ? unaccentIlike(schema.persons.name, `%${query}%`) : undefined;
	const where = and(publishedEntityVersionWhere(), searchWhere);

	const [items, aggregate] = await Promise.all([
		db
			.select({ id: schema.persons.id, name: schema.persons.name })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(schema.persons.sortName)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.persons)
			.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

export async function getPersonOptionsByIds(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return [];
	}

	const rows = await db
		.select({ id: schema.persons.id, name: schema.persons.name })
		.from(schema.persons)
		.innerJoin(schema.entityVersions, eq(schema.persons.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(and(publishedEntityVersionWhere(), inArray(schema.persons.id, [...ids])))
		.orderBy(schema.persons.sortName);

	const itemById = new Map(rows.map((row) => [row.id, row] as const));

	return ids.flatMap((id) => {
		const item = itemById.get(id);
		return item != null ? [item] : [];
	});
}

export async function getAvailablePersons() {
	const { items } = await getPersonOptions({ limit: 250 });
	return items;
}

export type AvailablePerson = PersonOption;

/**
 * `documentId` is the impact case study's `entities.id`. Contributors are document-level; each
 * person endpoint (also a document id) is resolved to its latest editable version for its name.
 */
export async function getImpactCaseStudyContributors(documentId: string) {
	return db
		.select({
			personId: schema.impactCaseStudiesToPersons.personDocumentId,
			personName: schema.persons.name,
			role: schema.impactCaseStudiesToPersons.role,
		})
		.from(schema.impactCaseStudiesToPersons)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.impactCaseStudiesToPersons.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, documentId));
}

export type ImpactCaseStudyContributor = Awaited<
	ReturnType<typeof getImpactCaseStudyContributors>
>[number];

/**
 * `documentId` is the spotlight article's `entities.id`. Contributors are document-level; each
 * person endpoint (also a document id) is resolved to its latest editable version for its name.
 */
export async function getSpotlightArticleContributors(documentId: string) {
	return db
		.select({
			personId: schema.spotlightArticlesToPersons.personDocumentId,
			personName: schema.persons.name,
			role: schema.spotlightArticlesToPersons.role,
		})
		.from(schema.spotlightArticlesToPersons)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.spotlightArticlesToPersons.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, documentId));
}

export type SpotlightArticleContributor = Awaited<
	ReturnType<typeof getSpotlightArticleContributors>
>[number];
