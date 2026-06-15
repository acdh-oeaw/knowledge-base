import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";
import { forbidden } from "next/navigation";

import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, desc, eq, inArray, or, sql } from "@/lib/db/sql";

export type InstitutionEricRelationStatus =
	| "is_cooperating_partner_of"
	| "is_national_coordinating_institution_in"
	| "is_national_representative_institution_in"
	| "is_partner_institution_of";

export type InstitutionsSort = "name" | "country" | "status";

interface GetInstitutionsParams {
	limit: number;
	offset: number;
	q?: string;
	sort?: InstitutionsSort;
	dir?: "asc" | "desc";
}

export interface InstitutionsResult {
	data: Array<
		Pick<
			schema.OrganisationalUnit,
			"acronym" | "id" | "name" | "ror" | "sshocMarketplaceActorId"
		> & {
			countryName: string | null;
			ericRelationStatuses: Array<InstitutionEricRelationStatus>;
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

const institutionType = "institution" as typeof schema.organisationalUnitTypes.$inferSelect.type;
const institutionStatuses = [
	"is_partner_institution_of",
	"is_cooperating_partner_of",
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
] as const satisfies Array<InstitutionEricRelationStatus>;
const dariahEuSlug = "dariah-eu";
const institutionStatusLabels: Record<InstitutionEricRelationStatus, string> = {
	is_cooperating_partner_of: "Cooperating partner",
	is_national_coordinating_institution_in: "National coordinating institution",
	is_national_representative_institution_in: "National representative institution",
	is_partner_institution_of: "Partner institution",
};
const pickedVersion = sql`COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`;
const versionPick = sql`${schema.entityVersions.id} = ${pickedVersion}`;

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

function normalizeInstitutionStatuses(
	statuses: ReadonlyArray<InstitutionEricRelationStatus>,
): Array<InstitutionEricRelationStatus> {
	return institutionStatuses.filter((status) => statuses.includes(status));
}

function getInstitutionStatusSortValue(
	statuses: ReadonlyArray<InstitutionEricRelationStatus>,
): string | null {
	const normalizedStatuses = normalizeInstitutionStatuses(statuses);

	if (normalizedStatuses.length === 0) {
		return null;
	}

	return normalizedStatuses.map((status) => institutionStatusLabels[status]).join(" | ");
}

async function getInstitutionRelationData(ids: ReadonlyArray<string>) {
	if (ids.length === 0) {
		return {
			countryNameByInstitutionId: new Map<string, string>(),
			statusesByInstitutionId: new Map<string, Array<InstitutionEricRelationStatus>>(),
		};
	}

	const erics = await db.query.organisationalUnits.findMany({
		where: { entityVersion: { entity: { slug: dariahEuSlug } }, type: { type: "eric" } },
		columns: { id: true },
	});
	const ericIds = erics.map((eric) => eric.id);

	// Unit↔unit relations are document-level; re-key the owner through entity_versions to keep the
	// institution *version* ids the caller passed in, and resolve related units by document.
	const instVersions = alias(schema.entityVersions, "inst_versions");
	const ericVersions = alias(schema.entityVersions, "eric_versions");
	const countryDocumentLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");
	const [relations, countries] = await Promise.all([
		ericIds.length > 0
			? db
					.select({
						status: schema.organisationalUnitStatus.status,
						unitId: instVersions.id,
					})
					.from(schema.organisationalUnitsRelations)
					.innerJoin(
						schema.organisationalUnitStatus,
						eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
					)
					.innerJoin(
						instVersions,
						eq(instVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
					)
					.innerJoin(
						ericVersions,
						eq(ericVersions.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
					)
					.where(
						and(
							inArray(instVersions.id, [...ids]),
							inArray(ericVersions.id, ericIds),
							inArray(schema.organisationalUnitStatus.status, institutionStatuses),
							sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
						),
					)
			: Promise.resolve([]),
		db
			.select({
				countryName: schema.organisationalUnits.name,
				unitId: instVersions.id,
			})
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
			)
			.innerJoin(
				instVersions,
				eq(instVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
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
					inArray(instVersions.id, [...ids]),
					eq(schema.organisationalUnitStatus.status, "is_located_in"),
					eq(
						schema.organisationalUnitTypes.type,
						"country" as typeof schema.organisationalUnitTypes.$inferSelect.type,
					),
					sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
				),
			),
	]);

	const statusesByInstitutionId = new Map<string, Array<InstitutionEricRelationStatus>>();
	const countryNameByInstitutionId = new Map<string, string>();

	for (const relation of relations) {
		const status = relation.status as InstitutionEricRelationStatus;
		const existing = statusesByInstitutionId.get(relation.unitId) ?? [];

		if (!existing.includes(status)) {
			existing.push(status);
			statusesByInstitutionId.set(relation.unitId, existing);
		}
	}

	for (const [institutionId, statuses] of statusesByInstitutionId.entries()) {
		statusesByInstitutionId.set(institutionId, normalizeInstitutionStatuses(statuses));
	}

	for (const country of countries) {
		if (!countryNameByInstitutionId.has(country.unitId)) {
			countryNameByInstitutionId.set(country.unitId, country.countryName);
		}
	}

	return { countryNameByInstitutionId, statusesByInstitutionId };
}

const itemSelect = {
	acronym: schema.organisationalUnits.acronym,
	id: schema.organisationalUnits.id,
	name: schema.organisationalUnits.name,
	ror: schema.organisationalUnits.ror,
	sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
	slug: schema.entities.slug,
	hasDraft: schema.documentLifecycle.hasDraftChanges,
	isPublished: sql<boolean>`${schema.documentLifecycle.publishedId} IS NOT NULL`,
} as const;

export async function getInstitutions(
	params: Readonly<GetInstitutionsParams>,
): Promise<InstitutionsResult> {
	const { limit, offset, q, sort = "name", dir = "asc" } = params;
	const query = q?.trim();
	const nameOrderBy =
		dir === "desc" ? desc(schema.organisationalUnits.name) : schema.organisationalUnits.name;
	const needsDerivedSort = sort === "country" || sort === "status";

	if ((query == null || query === "") && !needsDerivedSort) {
		const where = eq(schema.organisationalUnitTypes.type, institutionType);
		const [items, aggregate] = await Promise.all([
			db
				.select(itemSelect)
				.from(schema.organisationalUnits)
				.innerJoin(
					schema.organisationalUnitTypes,
					eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
				)
				.innerJoin(
					schema.entityVersions,
					eq(schema.organisationalUnits.id, schema.entityVersions.id),
				)
				.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
				.innerJoin(
					schema.documentLifecycle,
					eq(schema.documentLifecycle.documentId, schema.entities.id),
				)
				.where(and(versionPick, where))
				.orderBy(nameOrderBy)
				.limit(limit)
				.offset(offset),
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
		const institutionIds = items.map((item) => item.id);
		const { countryNameByInstitutionId, statusesByInstitutionId } =
			await getInstitutionRelationData(institutionIds);

		return {
			data: items.map((institution) => {
				return {
					countryName: countryNameByInstitutionId.get(institution.id) ?? null,
					entity: { slug: institution.slug },
					hasDraft: institution.hasDraft,
					isPublished: institution.isPublished,
					ericRelationStatuses: statusesByInstitutionId.get(institution.id) ?? [],
					acronym: institution.acronym,
					id: institution.id,
					name: institution.name,
					ror: institution.ror,
					sshocMarketplaceActorId: institution.sshocMarketplaceActorId,
				};
			}),
			limit,
			offset,
			total: aggregate.at(0)?.total ?? 0,
		};
	}

	// oxlint-disable-next-line no-useless-assignment
	let items: Array<{
		acronym: string | null;
		id: string;
		name: string;
		ror: string | null;
		sshocMarketplaceActorId: number | null;
		slug: string;
		hasDraft: boolean;
		isPublished: boolean;
	}> = [];
	// oxlint-disable-next-line no-useless-assignment
	let total = 0;

	if (query == null || query === "") {
		const where = eq(schema.organisationalUnitTypes.type, institutionType);
		items = await db
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
		total = items.length;
	} else {
		const matchingStatuses = institutionStatuses.filter((status) =>
			institutionStatusLabels[status].toLowerCase().includes(query.toLowerCase()),
		);

		// Unit↔unit relations are document-level; re-key the owner through entity_versions (all versions
		// of the institution document, so versionPick below still matches) and resolve the country by
		// document.
		const searchInstVersions = alias(schema.entityVersions, "search_inst_versions");
		const searchCountryDocumentLifecycle = alias(
			schema.documentLifecycle,
			"search_country_document_lifecycle",
		);

		const [nameMatches, countryMatches, statusMatches] = await Promise.all([
			db
				.select({ id: schema.organisationalUnits.id })
				.from(schema.organisationalUnits)
				.innerJoin(
					schema.organisationalUnitTypes,
					eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
				)
				.where(
					and(
						eq(schema.organisationalUnitTypes.type, institutionType),
						or(
							unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
							unaccentIlike(schema.organisationalUnits.acronym, `%${query}%`),
						),
					),
				),
			db
				.select({ id: searchInstVersions.id })
				.from(schema.organisationalUnitsRelations)
				.innerJoin(
					schema.organisationalUnitStatus,
					eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
				)
				.innerJoin(
					searchInstVersions,
					eq(searchInstVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
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
						eq(schema.organisationalUnitStatus.status, "is_located_in"),
						eq(
							schema.organisationalUnitTypes.type,
							"country" as typeof schema.organisationalUnitTypes.$inferSelect.type,
						),
						unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
						sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
					),
				),
			matchingStatuses.length > 0
				? db
						.select({ id: searchInstVersions.id })
						.from(schema.organisationalUnitsRelations)
						.innerJoin(
							schema.organisationalUnitStatus,
							eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
						)
						.innerJoin(
							searchInstVersions,
							eq(searchInstVersions.entityId, schema.organisationalUnitsRelations.unitDocumentId),
						)
						.where(
							and(
								inArray(schema.organisationalUnitStatus.status, matchingStatuses),
								sql`${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ`,
							),
						)
				: Promise.resolve([]),
		]);

		const matchedIds = Array.from(
			new Set([
				...nameMatches.map((item) => item.id),
				...countryMatches.map((item) => item.id),
				...statusMatches.map((item) => item.id),
			]),
		);

		if (matchedIds.length === 0) {
			return { data: [], limit, offset, total: 0 };
		}

		items = await db
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
					eq(schema.organisationalUnitTypes.type, institutionType),
					inArray(schema.organisationalUnits.id, matchedIds),
				),
			)
			.orderBy(nameOrderBy);
		total = items.length;
	}

	if (!needsDerivedSort) {
		const pagedItems = items.slice(offset, offset + limit);
		const { countryNameByInstitutionId, statusesByInstitutionId } =
			await getInstitutionRelationData(pagedItems.map((item) => item.id));

		return {
			data: pagedItems.map((institution) => {
				return {
					countryName: countryNameByInstitutionId.get(institution.id) ?? null,
					entity: { slug: institution.slug },
					hasDraft: institution.hasDraft,
					isPublished: institution.isPublished,
					ericRelationStatuses: statusesByInstitutionId.get(institution.id) ?? [],
					acronym: institution.acronym,
					id: institution.id,
					name: institution.name,
					ror: institution.ror,
					sshocMarketplaceActorId: institution.sshocMarketplaceActorId,
				};
			}),
			limit,
			offset,
			total,
		};
	}

	const { countryNameByInstitutionId, statusesByInstitutionId } = await getInstitutionRelationData(
		items.map((item) => item.id),
	);
	const sortedItems = items
		.map((institution) => {
			return {
				countryName: countryNameByInstitutionId.get(institution.id) ?? null,
				entity: { slug: institution.slug },
				hasDraft: institution.hasDraft,
				isPublished: institution.isPublished,
				ericRelationStatuses: statusesByInstitutionId.get(institution.id) ?? [],
				acronym: institution.acronym,
				id: institution.id,
				name: institution.name,
				ror: institution.ror,
				sshocMarketplaceActorId: institution.sshocMarketplaceActorId,
			};
		})
		.toSorted((a, b) => {
			if (sort === "country") {
				return (
					compareNullableStrings(a.countryName, b.countryName, dir) ||
					compareStrings(a.name, b.name, dir)
				);
			}

			return (
				compareNullableStrings(
					getInstitutionStatusSortValue(a.ericRelationStatuses),
					getInstitutionStatusSortValue(b.ericRelationStatuses),
					dir,
				) || compareStrings(a.name, b.name, dir)
			);
		});

	return {
		data: sortedItems.slice(offset, offset + limit),
		limit,
		offset,
		total,
	};
}

export async function getInstitutionsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetInstitutionsParams>,
): Promise<InstitutionsResult> {
	assertAdminUser(currentUser);

	return getInstitutions(params);
}
