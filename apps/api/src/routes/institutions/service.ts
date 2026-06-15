/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { generateImageUrl, toImageAsset } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import type { InstitutionRelationStatus, InstitutionStatus } from "@/routes/institutions/schemas";
import {
	type SQL,
	alias,
	and,
	countDistinct,
	desc,
	eq,
	inArray,
	isNull,
	or,
	sql,
} from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * The slug of the DARIAH-EU ERIC organisational unit. Institutions can relate to several `eric`
 * units, so partner/cooperating-partner relations are always pinned to this specific one — never
 * any other unit of type `eric`.
 */
const dariahEuSlug = "dariah-eu";

const apiToDbStatus = {
	partner_institution: "is_partner_institution_of",
	cooperating_partner: "is_cooperating_partner_of",
} as const satisfies Record<
	InstitutionRelationStatus,
	(typeof schema.organisationalUnitStatusEnum)[number]
>;

const dbToApiStatus = {
	is_partner_institution_of: "partner_institution",
	is_cooperating_partner_of: "cooperating_partner",
} as const satisfies Record<string, InstitutionRelationStatus>;

const ericRelationDbStatuses = [
	"is_partner_institution_of",
	"is_cooperating_partner_of",
] as const satisfies ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;

const institutionEntities = alias(schema.entities, "institution_entities");

/**
 * Resolves, per institution document, its active partner/cooperating-partner relation to the
 * DARIAH-EU ERIC. Pre-filtering in a subquery (rather than a broad left join on the relations
 * table) keeps the outer query to one row per institution — an institution always holds several
 * unit relations (e.g. `is_located_in`), and assumes at most one active DARIAH-EU relation.
 */
function ericRelationSubquery(db: Database | Transaction) {
	const relations = alias(schema.organisationalUnitsRelations, "eric_relations");
	const status = alias(schema.organisationalUnitStatus, "eric_relation_status");
	const lifecycle = alias(schema.documentLifecycle, "eric_lifecycle");
	const eric = alias(schema.organisationalUnits, "eric");
	const ericTypes = alias(schema.organisationalUnitTypes, "eric_types");
	const ericEntities = alias(schema.entities, "eric_entities");

	return db
		.select({
			unitDocumentId: relations.unitDocumentId,
			status: status.status,
		})
		.from(relations)
		.innerJoin(
			status,
			and(eq(relations.status, status.id), inArray(status.status, ericRelationDbStatuses)),
		)
		.innerJoin(lifecycle, eq(lifecycle.documentId, relations.relatedUnitDocumentId))
		.innerJoin(
			ericEntities,
			and(eq(ericEntities.id, lifecycle.documentId), eq(ericEntities.slug, dariahEuSlug)),
		)
		.innerJoin(eric, eq(eric.id, lifecycle.publishedId))
		.innerJoin(ericTypes, and(eq(eric.typeId, ericTypes.id), eq(ericTypes.type, "eric")))
		.where(sql`${relations.duration} @> NOW()::TIMESTAMPTZ`)
		.as("eric_relation");
}

/**
 * Resolves, per institution document, the country it is located in (`is_located_in`). Pre-filtered
 * in a subquery for the same single-row reason as {@link ericRelationSubquery}.
 */
function countryRelationSubquery(db: Database | Transaction) {
	const relations = alias(schema.organisationalUnitsRelations, "country_relations");
	const status = alias(schema.organisationalUnitStatus, "country_relation_status");
	const lifecycle = alias(schema.documentLifecycle, "country_lifecycle");
	const countries = alias(schema.organisationalUnits, "countries");
	const countryTypes = alias(schema.organisationalUnitTypes, "country_types");
	const countryEntities = alias(schema.entities, "country_entities");

	return db
		.select({
			unitDocumentId: relations.unitDocumentId,
			countryId: countries.id,
			countryName: countries.name,
			countrySlug: countryEntities.slug,
		})
		.from(relations)
		.innerJoin(status, and(eq(relations.status, status.id), eq(status.status, "is_located_in")))
		.innerJoin(lifecycle, eq(lifecycle.documentId, relations.relatedUnitDocumentId))
		.innerJoin(countries, eq(countries.id, lifecycle.publishedId))
		.innerJoin(
			countryTypes,
			and(eq(countries.typeId, countryTypes.id), eq(countryTypes.type, "country")),
		)
		.innerJoin(countryEntities, eq(countryEntities.id, lifecycle.documentId))
		.where(sql`${relations.duration} @> NOW()::TIMESTAMPTZ`)
		.as("country_relation");
}

/** Published institutions, regardless of their relation to DARIAH-EU. */
function baseInstitutionFilter(): SQL | undefined {
	return and(
		eq(schema.organisationalUnitTypes.type, "institution"),
		eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
	);
}

/**
 * Narrows institutions to the requested DARIAH-EU statuses (the union of the requested values).
 * `none` matches institutions with no active partner/cooperating-partner relation, i.e. a missing
 * row in the eric relation subquery.
 */
function statusFilter(
	ericRelation: ReturnType<typeof ericRelationSubquery>,
	status?: Array<InstitutionStatus>,
): SQL | undefined {
	if (status == null || status.length === 0) {
		return undefined;
	}

	const relationStatuses = status
		.filter((value): value is InstitutionRelationStatus => value !== "none")
		.map((value) => apiToDbStatus[value]);
	const includeNone = status.includes("none");

	const conditions: Array<SQL> = [];
	if (relationStatuses.length > 0) {
		conditions.push(inArray(ericRelation.status, relationStatuses));
	}
	if (includeNone) {
		conditions.push(isNull(ericRelation.status));
	}

	return conditions.length > 1 ? or(...conditions) : conditions.at(0);
}

function institutionQuery(db: Database | Transaction) {
	const ericRelation = ericRelationSubquery(db);
	const countryRelation = countryRelationSubquery(db);

	const query = db
		.select({
			id: schema.organisationalUnits.id,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			ror: schema.organisationalUnits.ror,
			slug: institutionEntities.slug,
			logoKey: schema.assets.key,
			logoAlt: schema.assets.alt,
			logoCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			status: ericRelation.status,
			countryId: countryRelation.countryId,
			countryName: countryRelation.countryName,
			countrySlug: countryRelation.countrySlug,
			updatedAt: schema.entityVersions.updatedAt,
		})
		.from(schema.organisationalUnits)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
		)
		.innerJoin(institutionEntities, eq(schema.entityVersions.entityId, institutionEntities.id))
		.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.leftJoin(ericRelation, eq(ericRelation.unitDocumentId, schema.entityVersions.entityId))
		.leftJoin(countryRelation, eq(countryRelation.unitDocumentId, schema.entityVersions.entityId));

	return { query, ericRelation };
}

function institutionCountQuery(db: Database | Transaction) {
	const ericRelation = ericRelationSubquery(db);

	const query = db
		.select({ total: countDistinct(schema.organisationalUnits.id) })
		.from(schema.organisationalUnits)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
		)
		.leftJoin(ericRelation, eq(ericRelation.unitDocumentId, schema.entityVersions.entityId));

	return { query, ericRelation };
}

interface InstitutionRow {
	id: string;
	name: string;
	acronym: string | null;
	ror: string | null;
	slug: string;
	logoKey: string | null;
	logoAlt: string | null;
	logoCaption: string | null;
	licenseName: string | null;
	licenseUrl: string | null;
	status: (typeof schema.organisationalUnitStatusEnum)[number] | null;
	countryId: string | null;
	countryName: string | null;
	countrySlug: string | null;
	updatedAt: Date;
}

function mapInstitutionRow(row: InstitutionRow) {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		acronym: row.acronym,
		ror: row.ror,
		status: (row.status != null
			? dbToApiStatus[row.status as keyof typeof dbToApiStatus]
			: "none") satisfies InstitutionStatus,
		country:
			row.countryId != null && row.countryName != null && row.countrySlug != null
				? {
						id: row.countryId,
						name: row.countryName,
						slug: row.countrySlug,
					}
				: null,
		logo: generateImageUrl(
			toImageAsset({
				key: row.logoKey,
				alt: row.logoAlt,
				caption: row.logoCaption,
				licenseName: row.licenseName,
				licenseUrl: row.licenseUrl,
			}),
			imageWidth.preview,
		),
	};
}

interface GetInstitutionsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	status?: Array<InstitutionStatus>;
}

export async function getInstitutions(db: Database | Transaction, params: GetInstitutionsParams) {
	const { limit = 10, offset = 0, status } = params;

	const list = institutionQuery(db);
	const aggregate = institutionCountQuery(db);

	const [items, totals] = await Promise.all([
		list.query
			.where(and(baseInstitutionFilter(), statusFilter(list.ericRelation, status)))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		aggregate.query.where(
			and(baseInstitutionFilter(), statusFilter(aggregate.ericRelation, status)),
		),
	]);

	const total = totals.at(0)?.total ?? 0;
	const data = items.map((row) => mapInstitutionRow(row));

	return { data, limit, offset, total };
}

interface GetInstitutionByIdParams {
	id: schema.OrganisationalUnit["id"];
}

export async function getInstitutionById(
	db: Database | Transaction,
	params: GetInstitutionByIdParams,
) {
	const { id } = params;

	const { query } = institutionQuery(db);
	const item = await query
		.where(and(baseInstitutionFilter(), eq(schema.organisationalUnits.id, id)))
		.limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapInstitutionRow(row);
}

interface GetInstitutionSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

export async function getInstitutionSlugs(
	db: Database | Transaction,
	params: GetInstitutionSlugsParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
				slug: institutionEntities.slug,
			})
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.innerJoin(institutionEntities, eq(schema.entityVersions.entityId, institutionEntities.id))
			.where(baseInstitutionFilter())
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: countDistinct(schema.organisationalUnits.id) })
			.from(schema.organisationalUnits)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(baseInstitutionFilter()),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	return { data: items, limit, offset, total };
}

interface GetInstitutionBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getInstitutionBySlug(
	db: Database | Transaction,
	params: GetInstitutionBySlugParams,
) {
	const { slug } = params;

	const { query } = institutionQuery(db);
	const item = await query
		.where(and(baseInstitutionFilter(), eq(institutionEntities.slug, slug)))
		.limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapInstitutionRow(row);
}
