import * as schema from "@acdh-knowledge-base/database/schema";

import { relationOptionsPageSize } from "@/lib/constants/relations";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import type { OrganisationalUnitType } from "@/lib/data/organisational-units";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, count, eq, inArray, sql } from "@/lib/db/sql";

/**
 * `unitDocumentId` is the owner unit's `entities.id`. Unit↔unit relations are document-level, so
 * there is a single set per unit document (no draft/published diff); the related unit is resolved
 * to its latest editable version for display.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getUnitRelations(unitDocumentId: string) {
	const relatedUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"related_unit_document_lifecycle",
	);

	return db
		.select({
			id: schema.organisationalUnitsRelations.id,
			duration: schema.organisationalUnitsRelations.duration,
			statusId: schema.organisationalUnitsRelations.status,
			statusType: schema.organisationalUnitStatus.status,
			relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
			relatedUnitName: schema.organisationalUnits.name,
			relatedUnitSlug: schema.entities.slug,
			relatedUnitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.relatedUnitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			relatedUnitDocumentLifecycle,
			eq(
				relatedUnitDocumentLifecycle.documentId,
				schema.organisationalUnitsRelations.relatedUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${relatedUnitDocumentLifecycle.draftId}, ${relatedUnitDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(eq(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentId))
		.orderBy(
			sql`UPPER(${schema.organisationalUnitsRelations.duration}) DESC NULLS FIRST`,
			sql`LOWER(${schema.organisationalUnitsRelations.duration}) DESC`,
		);
}

export type UnitRelation = Awaited<ReturnType<typeof getUnitRelations>>[number];

/** The literal union of relation types (e.g. "is_member_of", "is_part_of"). */
export type UnitRelationStatusType = typeof schema.organisationalUnitStatus.$inferSelect.status;

export interface UnitRelationStatusOption {
	statusId: string;
	statusType: UnitRelationStatusType;
}

interface GetUnitRelationRelatedUnitOptionsParams {
	unitDocumentId: string;
	statusId: string;
	limit?: number;
	offset?: number;
	q?: string;
}

export async function getUnitRelationStatusOptions(
	unitType: string,
): Promise<Array<UnitRelationStatusOption>> {
	const rows = await db
		.select({
			statusId: schema.organisationalUnitStatus.id,
			statusType: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitsAllowedRelations)
		.innerJoin(
			schema.organisationalUnitTypes,
			and(
				eq(
					schema.organisationalUnitTypes.id,
					schema.organisationalUnitsAllowedRelations.unitTypeId,
				),
				eq(
					schema.organisationalUnitTypes.type,
					unitType as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
			),
		)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(
				schema.organisationalUnitStatus.id,
				schema.organisationalUnitsAllowedRelations.relationTypeId,
			),
		)
		.orderBy(schema.organisationalUnitStatus.status);

	const byStatusId = new Map(rows.map((row) => [row.statusId, row] as const));

	return [...byStatusId.values()];
}

export async function getUnitRelationRelatedUnitOptions(
	params: GetUnitRelationRelatedUnitOptionsParams,
): Promise<{ items: Array<{ id: string; name: string }>; total: number }> {
	const { unitDocumentId, statusId, limit = relationOptionsPageSize, offset = 0, q } = params;
	const query = q?.trim();

	const currentUnit = await db
		.select({ typeId: schema.organisationalUnits.typeId })
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.documentLifecycle.documentId, unitDocumentId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (currentUnit == null) {
		return { items: [], total: 0 };
	}

	const allowedRelatedUnitTypes = await db
		.select({ relatedUnitTypeId: schema.organisationalUnitsAllowedRelations.relatedUnitTypeId })
		.from(schema.organisationalUnitsAllowedRelations)
		.where(
			and(
				eq(schema.organisationalUnitsAllowedRelations.unitTypeId, currentUnit.typeId),
				eq(schema.organisationalUnitsAllowedRelations.relationTypeId, statusId),
			),
		);

	const relatedUnitTypeIds = [
		...new Set(allowedRelatedUnitTypes.map((row) => row.relatedUnitTypeId)),
	];

	if (relatedUnitTypeIds.length === 0) {
		return { items: [], total: 0 };
	}

	const where = and(
		publishedEntityVersionWhere(),
		inArray(schema.organisationalUnits.typeId, relatedUnitTypeIds),
		query != null && query !== ""
			? unaccentIlike(schema.organisationalUnits.name, `%${query}%`)
			: undefined,
	);

	const [items, aggregate] = await Promise.all([
		db
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where)
			.orderBy(schema.organisationalUnits.name)
			.limit(limit)
			.offset(offset),
		db
			.select({ total: count() })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.where(where),
	]);

	return { items, total: aggregate.at(0)?.total ?? 0 };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getUnitRelationOptions(unitType: string) {
	const allowedCombos = await db
		.select({
			statusId: schema.organisationalUnitStatus.id,
			statusType: schema.organisationalUnitStatus.status,
			relatedUnitTypeId: schema.organisationalUnitsAllowedRelations.relatedUnitTypeId,
		})
		.from(schema.organisationalUnitsAllowedRelations)
		.innerJoin(
			schema.organisationalUnitTypes,
			and(
				eq(
					schema.organisationalUnitTypes.id,
					schema.organisationalUnitsAllowedRelations.unitTypeId,
				),
				eq(
					schema.organisationalUnitTypes.type,
					unitType as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
			),
		)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(
				schema.organisationalUnitStatus.id,
				schema.organisationalUnitsAllowedRelations.relationTypeId,
			),
		);

	if (allowedCombos.length === 0) {
		return [];
	}

	const relatedUnitTypeIds = [...new Set(allowedCombos.map((c) => c.relatedUnitTypeId))];

	const relatedUnits = await db
		.select({
			id: schema.entityVersions.entityId,
			name: schema.organisationalUnits.name,
			typeId: schema.organisationalUnits.typeId,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.where(
			and(
				publishedEntityVersionWhere(),
				inArray(schema.organisationalUnits.typeId, relatedUnitTypeIds),
			),
		);

	const byStatus = new Map<
		string,
		{ statusId: string; statusType: string; availableUnits: Array<{ id: string; name: string }> }
	>();

	for (const combo of allowedCombos) {
		if (!byStatus.has(combo.statusId)) {
			byStatus.set(combo.statusId, {
				statusId: combo.statusId,
				statusType: combo.statusType,
				availableUnits: [],
			});
		}

		const entry = byStatus.get(combo.statusId)!;

		for (const unit of relatedUnits) {
			if (
				unit.typeId === combo.relatedUnitTypeId &&
				!entry.availableUnits.some((u) => u.id === unit.id)
			) {
				entry.availableUnits.push({ id: unit.id, name: unit.name });
			}
		}
	}

	return Array.from(byStatus.values()).map((entry) => {
		return {
			...entry,
			availableUnits: entry.availableUnits.toSorted((a, b) => a.name.localeCompare(b.name)),
		};
	});
}

export type UnitRelationOption = Awaited<ReturnType<typeof getUnitRelationOptions>>[number];

/**
 * Reverse of {@link getUnitRelations}: every relation that points _at_ `relatedUnitDocumentId`. The
 * relation row stays owned by the source (`unitDocumentId`) unit; this lists those owners resolved
 * to their latest editable version, so a unit can be edited from the perspective of the unit it
 * relates to (e.g. a national consortium managing its member institutions). Optionally restrict to
 * a single source unit type.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getReverseUnitRelations(
	relatedUnitDocumentId: string,
	options: { sourceUnitType?: OrganisationalUnitType } = {},
) {
	const { sourceUnitType } = options;

	const ownerUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"owner_unit_document_lifecycle",
	);

	return db
		.select({
			id: schema.organisationalUnitsRelations.id,
			duration: schema.organisationalUnitsRelations.duration,
			statusId: schema.organisationalUnitsRelations.status,
			statusType: schema.organisationalUnitStatus.status,
			unitDocumentId: schema.organisationalUnitsRelations.unitDocumentId,
			unitName: schema.organisationalUnits.name,
			unitSlug: schema.entities.slug,
			unitType: schema.organisationalUnitTypes.type,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			ownerUnitDocumentLifecycle,
			eq(ownerUnitDocumentLifecycle.documentId, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${ownerUnitDocumentLifecycle.draftId}, ${ownerUnitDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, relatedUnitDocumentId),
				sourceUnitType != null
					? eq(schema.organisationalUnitTypes.type, sourceUnitType)
					: undefined,
			),
		)
		.orderBy(
			sql`UPPER(${schema.organisationalUnitsRelations.duration}) DESC NULLS FIRST`,
			sql`LOWER(${schema.organisationalUnitsRelations.duration}) DESC`,
			schema.organisationalUnits.name,
		);
}

export type ReverseUnitRelation = Awaited<ReturnType<typeof getReverseUnitRelations>>[number];

/**
 * Reverse of {@link getUnitRelationStatusOptions}: the relation types allowed _into_
 * `relatedUnitType` (i.e. where it is the target), optionally narrowed to a single source unit
 * type.
 */
export async function getReverseUnitRelationStatusOptions(
	relatedUnitType: OrganisationalUnitType,
	sourceUnitType?: OrganisationalUnitType,
): Promise<Array<UnitRelationStatusOption>> {
	const sourceType = alias(schema.organisationalUnitTypes, "reverse_source_unit_type");
	const relatedType = alias(schema.organisationalUnitTypes, "reverse_related_unit_type");

	const rows = await db
		.select({
			statusId: schema.organisationalUnitStatus.id,
			statusType: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitsAllowedRelations)
		.innerJoin(
			relatedType,
			and(
				eq(relatedType.id, schema.organisationalUnitsAllowedRelations.relatedUnitTypeId),
				eq(relatedType.type, relatedUnitType),
			),
		)
		.innerJoin(sourceType, eq(sourceType.id, schema.organisationalUnitsAllowedRelations.unitTypeId))
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(
				schema.organisationalUnitStatus.id,
				schema.organisationalUnitsAllowedRelations.relationTypeId,
			),
		)
		.where(sourceUnitType != null ? eq(sourceType.type, sourceUnitType) : undefined)
		.orderBy(schema.organisationalUnitStatus.status);

	const byStatusId = new Map(rows.map((row) => [row.statusId, row] as const));

	return [...byStatusId.values()];
}

/**
 * The `institution -> eric` relation types that represent a country in DARIAH ERIC. These are
 * edited from the institution / ERIC side; here they are surfaced read-only on the country, scoped
 * to institutions located in that country.
 */
const countryEricInstitutionStatuses = [
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
	"is_partner_institution_of",
	"is_cooperating_partner_of",
] as const satisfies ReadonlyArray<UnitRelationStatusType>;

/**
 * Derived "lens" view: institutions located in `countryDocumentId` that also hold a representation
 * relation to DARIAH ERIC (partner / cooperating / national coordinating / national
 * representative). Joins the `institution is_located_in country` edge to the `institution <status>
 * eric` edge; the displayed duration is the ERIC relation's. Read-only — editing happens on the
 * institution itself.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getEricInstitutionsForCountry(countryDocumentId: string) {
	const ericRelations = alias(schema.organisationalUnitsRelations, "country_eric_relations");
	const locatedInRelations = alias(
		schema.organisationalUnitsRelations,
		"country_located_in_relations",
	);
	const ericStatus = alias(schema.organisationalUnitStatus, "country_eric_status");
	const locatedInStatus = alias(schema.organisationalUnitStatus, "country_located_in_status");
	const institutionLifecycle = alias(
		schema.documentLifecycle,
		"country_eric_institution_lifecycle",
	);

	const rows = await db
		.select({
			id: ericRelations.id,
			institutionId: ericRelations.unitDocumentId,
			institutionName: schema.organisationalUnits.name,
			institutionSlug: schema.entities.slug,
			institutionType: schema.organisationalUnitTypes.type,
			statusId: ericStatus.id,
			statusType: ericStatus.status,
			duration: ericRelations.duration,
		})
		.from(ericRelations)
		.innerJoin(ericStatus, eq(ericStatus.id, ericRelations.status))
		.innerJoin(
			locatedInRelations,
			eq(locatedInRelations.unitDocumentId, ericRelations.unitDocumentId),
		)
		.innerJoin(locatedInStatus, eq(locatedInStatus.id, locatedInRelations.status))
		.innerJoin(
			institutionLifecycle,
			eq(institutionLifecycle.documentId, ericRelations.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${institutionLifecycle.draftId}, ${institutionLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(schema.entities, eq(schema.entities.id, ericRelations.unitDocumentId))
		.where(
			and(
				inArray(ericStatus.status, [...countryEricInstitutionStatuses]),
				eq(locatedInStatus.status, "is_located_in"),
				eq(locatedInRelations.relatedUnitDocumentId, countryDocumentId),
			),
		)
		.orderBy(ericStatus.status, schema.organisationalUnits.name);

	// An institution could have more than one located-in row for the country; key by the ERIC row.
	const byId = new Map(rows.map((row) => [row.id, row] as const));

	return [...byId.values()];
}

export type CountryEricInstitution = Awaited<
	ReturnType<typeof getEricInstitutionsForCountry>
>[number];

/** Slug of the DARIAH ERIC organisational unit. Relations to ERIC are resolved against this. */
const dariahEricSlug = "dariah-eu";

export type CountryReportInstitutionRepresentation =
	(typeof schema.countryReportInstitutionRepresentationEnum)[number];

/**
 * Resolve the DARIAH ERIC organisational unit's document id (`entities.id`), explicitly by its
 * `dariah-eu` slug _and_ `eric` type — we deliberately do not assume a single `eric`-typed unit.
 * Returns `null` if it is absent.
 */
export async function getDariahEricDocumentId(): Promise<string | null> {
	const unit = await db.query.organisationalUnits.findFirst({
		where: { type: { type: "eric" }, entityVersion: { entity: { slug: dariahEricSlug } } },
		columns: {},
		with: { entityVersion: { columns: {}, with: { entity: { columns: { id: true } } } } },
	});

	return unit?.entityVersion.entity.id ?? null;
}

/**
 * The institutions that count as current partner institutions of `countryDocumentId` for the given
 * reporting `year`: institutions `is_located_in` the country that also hold an `institution ->
 * eric` representation relation whose duration overlaps the reporting calendar year. One row per
 * institution — if it holds several representation relations that year, the most significant is
 * kept (coordinating > representative > partner > cooperating). Used to capture the country-report
 * institutions snapshot.
 */
export interface CurrentPartnerInstitution {
	institutionDocumentId: string;
	representationType: CountryReportInstitutionRepresentation;
	name: string;
	acronym: string | null;
	slug: string;
}

export async function getCurrentPartnerInstitutions(
	countryDocumentId: string,
	year: number,
): Promise<Array<CurrentPartnerInstitution>> {
	const ericDocumentId = await getDariahEricDocumentId();
	if (ericDocumentId == null) {
		return [];
	}

	const ericRelations = alias(schema.organisationalUnitsRelations, "capture_eric_relations");
	const locatedInRelations = alias(schema.organisationalUnitsRelations, "capture_located_in");
	const ericStatus = alias(schema.organisationalUnitStatus, "capture_eric_status");
	const locatedInStatus = alias(schema.organisationalUnitStatus, "capture_located_in_status");
	const institutionLifecycle = alias(schema.documentLifecycle, "capture_institution_lifecycle");

	const representationPrecedence = sql`
		CASE ${ericStatus.status}
			WHEN 'is_national_coordinating_institution_in' THEN 1
			WHEN 'is_national_representative_institution_in' THEN 2
			WHEN 'is_partner_institution_of' THEN 3
			ELSE 4
		END
	`;

	const rows = await db
		.select({
			institutionDocumentId: ericRelations.unitDocumentId,
			representationType: ericStatus.status,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			slug: schema.entities.slug,
		})
		.from(ericRelations)
		.innerJoin(ericStatus, eq(ericStatus.id, ericRelations.status))
		.innerJoin(
			locatedInRelations,
			eq(locatedInRelations.unitDocumentId, ericRelations.unitDocumentId),
		)
		.innerJoin(locatedInStatus, eq(locatedInStatus.id, locatedInRelations.status))
		.innerJoin(
			institutionLifecycle,
			eq(institutionLifecycle.documentId, ericRelations.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${institutionLifecycle.draftId}, ${institutionLifecycle.publishedId})`,
		)
		.innerJoin(schema.entities, eq(schema.entities.id, ericRelations.unitDocumentId))
		.where(
			and(
				eq(ericRelations.relatedUnitDocumentId, ericDocumentId),
				inArray(ericStatus.status, [...schema.countryReportInstitutionRepresentationEnum]),
				eq(locatedInStatus.status, "is_located_in"),
				eq(locatedInRelations.relatedUnitDocumentId, countryDocumentId),
				sql`
					${ericRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		)
		.orderBy(representationPrecedence, schema.organisationalUnits.name);

	// One row per institution; the precedence ordering keeps the most significant representation.
	const byInstitution = new Map<string, CurrentPartnerInstitution>();
	for (const row of rows) {
		if (!byInstitution.has(row.institutionDocumentId)) {
			byInstitution.set(row.institutionDocumentId, {
				institutionDocumentId: row.institutionDocumentId,
				representationType: row.representationType as CountryReportInstitutionRepresentation,
				name: row.name,
				acronym: row.acronym,
				slug: row.slug,
			});
		}
	}

	return [...byInstitution.values()];
}
