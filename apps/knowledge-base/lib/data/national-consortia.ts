import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, desc, eq, inArray, sql } from "@/lib/db/sql";

export type NationalConsortiaSort = "name" | "country";

interface GetNationalConsortiaParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: NationalConsortiaSort;
	dir?: "asc" | "desc";
}

export interface NationalConsortiaResult {
	data: Array<
		Pick<schema.OrganisationalUnit, "id" | "name" | "sshocMarketplaceActorId"> & {
			countryName: string | null;
			entity: Pick<schema.Entity, "slug">;
			hasDraft: boolean;
			isPublished: boolean;
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

function compareStrings(a: string, b: string, dir: "asc" | "desc"): number {
	return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNullableStrings(a: string | null, b: string | null, dir: "asc" | "desc"): number {
	if (a == null && b == null) {
		return 0;
	}
	if (a == null) {
		return 1;
	}
	if (b == null) {
		return -1;
	}
	return compareStrings(a, b, dir);
}

async function getCountryNamesByUnitIds(
	ids: ReadonlyArray<string>,
): Promise<Map<string, string | null>> {
	if (ids.length === 0) {
		return new Map();
	}

	// Unit↔unit relations are document-level; re-key the consortium through entity_versions to keep
	// the version ids passed in, and resolve the country by document.
	const consortiumVersions = alias(schema.entityVersions, "consortium_versions");
	const countryDocumentLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");
	const relatedCountries = await db
		.select({
			countryName: schema.organisationalUnits.name,
			duration: schema.organisationalUnitsRelations.duration,
			unitId: consortiumVersions.id,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			consortiumVersions,
			eq(consortiumVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			countryDocumentLifecycle,
			eq(
				countryDocumentLifecycle.documentId,
				schema.organisationalUnitsRelations.relatedUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${countryDocumentLifecycle.publishedId}, ${countryDocumentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				inArray(consortiumVersions.id, [...ids]),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"country" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
			),
		);

	const countryByUnitId = new Map<string, { from: Date; name: string; until: Date | null }>();

	for (const relation of relatedCountries) {
		const existing = countryByUnitId.get(relation.unitId);
		const nextRelation = {
			from: relation.duration.start,
			name: relation.countryName,
			until: relation.duration.end ?? null,
		};

		if (existing == null) {
			countryByUnitId.set(relation.unitId, nextRelation);
			continue;
		}

		const shouldReplace =
			(existing.until != null && nextRelation.until == null) || nextRelation.from > existing.from;

		if (shouldReplace) {
			countryByUnitId.set(relation.unitId, nextRelation);
		}
	}

	return new Map(ids.map((id) => [id, countryByUnitId.get(id)?.name ?? null] as const));
}

const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

const itemSelect = {
	id: schema.organisationalUnits.id,
	name: schema.organisationalUnits.name,
	sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
	slug: schema.entities.slug,
	hasDraft: schema.documentLifecycle.hasDraftChanges,
	isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
} as const;

export async function getNationalConsortia(
	params: Readonly<GetNationalConsortiaParams>,
): Promise<NationalConsortiaResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const consortiumType =
		"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type;
	const nameOrderBy =
		dir === "desc" ? desc(schema.organisationalUnits.name) : schema.organisationalUnits.name;

	if (query == null || query === "") {
		const where = eq(schema.organisationalUnitTypes.type, consortiumType);
		const baseItemsQuery = db
			.select(itemSelect)
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.where(and(versionPick, where))
			.orderBy(nameOrderBy);

		const [items, aggregate] = await Promise.all([
			sort === "country" ? baseItemsQuery : baseItemsQuery.limit(limit).offset(offset),
			db
				.select({ total: count() })
				.from(schema.organisationalUnits)
				.innerJoin(
					schema.organisationalUnitTypes,
					eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
				)
				.innerJoin(
					schema.entityVersions,
					eq(schema.organisationalUnits.id, schema.entityVersions.id),
				)
				.innerJoin(
					schema.documentLifecycle,
					eq(schema.documentLifecycle.documentId, schema.entityVersions.entityId),
				)
				.where(and(versionPick, where)),
		]);

		if (sort !== "country") {
			const countryNames = await getCountryNamesByUnitIds(items.map((item) => item.id));

			return {
				data: items.map((item) => {
					return {
						countryName: countryNames.get(item.id) ?? null,
						entity: { slug: item.slug },
						hasDraft: item.hasDraft,
						isPublished: item.isPublished,
						id: item.id,
						name: item.name,
						sshocMarketplaceActorId: item.sshocMarketplaceActorId,
					};
				}),
				limit,
				offset,
				total: aggregate.at(0)?.total ?? 0,
			};
		}

		const countryNames = await getCountryNamesByUnitIds(items.map((item) => item.id));
		const sortedItems = items
			.map((item) => {
				return {
					countryName: countryNames.get(item.id) ?? null,
					entity: { slug: item.slug },
					hasDraft: item.hasDraft,
					isPublished: item.isPublished,
					id: item.id,
					name: item.name,
					sshocMarketplaceActorId: item.sshocMarketplaceActorId,
				};
			})
			.toSorted(
				(a, b) =>
					compareNullableStrings(a.countryName, b.countryName, dir) ||
					compareStrings(a.name, b.name, dir),
			);

		return {
			data: sortedItems.slice(offset, offset + limit),
			limit,
			offset,
			total: aggregate.at(0)?.total ?? 0,
		};
	}

	const searchConsortiumVersions = alias(schema.entityVersions, "search_consortium_versions");
	const searchCountryDocumentLifecycle = alias(
		schema.documentLifecycle,
		"search_country_document_lifecycle",
	);
	const [nameMatches, countryMatches] = await Promise.all([
		db
			.select({ id: schema.organisationalUnits.id })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					eq(schema.organisationalUnitTypes.type, consortiumType),
					unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
				),
			),
		db
			.select({ id: searchConsortiumVersions.id })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				searchConsortiumVersions,
				eq(searchConsortiumVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
			)
			.innerJoin(
				searchCountryDocumentLifecycle,
				eq(
					searchCountryDocumentLifecycle.documentId,
					schema.organisationalUnitsRelations.relatedUnitDocumentId,
				),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${searchCountryDocumentLifecycle.publishedId}, ${searchCountryDocumentLifecycle.draftId})`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(
				and(
					eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
					eq(
						schema.organisationalUnitTypes.type,
						"country" as typeof schema.organisationalUnitTypes.$inferSelect.type,
					),
					unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
				),
			),
	]);

	const matchedIds = Array.from(
		new Set([...nameMatches.map((item) => item.id), ...countryMatches.map((item) => item.id)]),
	);

	if (matchedIds.length === 0) {
		return { data: [], limit, offset, total: 0 };
	}

	const orderedItems = await db
		.select(itemSelect)
		.from(schema.organisationalUnits)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.where(
			and(
				versionPick,
				eq(schema.organisationalUnitTypes.type, consortiumType),
				inArray(schema.organisationalUnits.id, matchedIds),
			),
		)
		.orderBy(nameOrderBy);

	if (sort !== "country") {
		const pagedItems = orderedItems.slice(offset, offset + limit);
		const countryNames = await getCountryNamesByUnitIds(pagedItems.map((item) => item.id));

		return {
			data: pagedItems.map((item) => {
				return {
					countryName: countryNames.get(item.id) ?? null,
					entity: { slug: item.slug },
					hasDraft: item.hasDraft,
					isPublished: item.isPublished,
					id: item.id,
					name: item.name,
					sshocMarketplaceActorId: item.sshocMarketplaceActorId,
				};
			}),
			limit,
			offset,
			total: orderedItems.length,
		};
	}

	const countryNames = await getCountryNamesByUnitIds(orderedItems.map((item) => item.id));
	const sortedItems = orderedItems
		.map((item) => {
			return {
				countryName: countryNames.get(item.id) ?? null,
				entity: { slug: item.slug },
				hasDraft: item.hasDraft,
				isPublished: item.isPublished,
				id: item.id,
				name: item.name,
				sshocMarketplaceActorId: item.sshocMarketplaceActorId,
			};
		})
		.toSorted(
			(a, b) =>
				compareNullableStrings(a.countryName, b.countryName, dir) ||
				compareStrings(a.name, b.name, dir),
		);

	return {
		data: sortedItems.slice(offset, offset + limit),
		limit,
		offset,
		total: orderedItems.length,
	};
}

export async function getNationalConsortiaForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetNationalConsortiaParams>,
): Promise<NationalConsortiaResult> {
	assertAdminUser(currentUser);

	return getNationalConsortia(params);
}
