/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";

import { generateImageUrl, toImageAsset } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetNationalConsortiaParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
}

const countryRelations = alias(schema.organisationalUnitsRelations, "country_relations");
const countryRelationStatus = alias(schema.organisationalUnitStatus, "country_relation_status");
const countries = alias(schema.organisationalUnits, "countries");
const countryTypes = alias(schema.organisationalUnitTypes, "country_types");
const countryLifecycle = alias(schema.documentLifecycle, "country_lifecycle");
const countryEntities = alias(schema.entities, "country_entities");
const consortiumEntities = alias(schema.entities, "consortium_entities");

const nationalConsortiumFilter = and(
	eq(schema.organisationalUnitTypes.type, "national_consortium"),
	eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
);

function selectNationalConsortiumRows() {
	return {
		id: schema.organisationalUnits.id,
		name: schema.organisationalUnits.name,
		acronym: schema.organisationalUnits.acronym,
		slug: consortiumEntities.slug,
		logoKey: schema.assets.key,
		logoAlt: schema.assets.alt,
		logoCaption: schema.assets.caption,
		licenseName: schema.licenses.name,
		licenseUrl: schema.licenses.url,
		countryId: countries.id,
		countryName: countries.name,
		countrySlug: countryEntities.slug,
		countryType: countryTypes.type,
		updatedAt: schema.entityVersions.updatedAt,
	};
}

interface NationalConsortiumRow {
	id: string;
	name: string;
	acronym: string | null;
	slug: string;
	logoKey: string | null;
	logoAlt: string | null;
	logoCaption: string | null;
	licenseName: string | null;
	licenseUrl: string | null;
	countryId: string | null;
	countryName: string | null;
	countrySlug: string | null;
	countryType: (typeof schema.organisationalUnitTypesEnum)[number] | null;
	updatedAt: Date;
}

function fromNationalConsortia(db: Database | Transaction) {
	return db
		.select(selectNationalConsortiumRows())
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
		.innerJoin(consortiumEntities, eq(schema.entityVersions.entityId, consortiumEntities.id))
		.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.leftJoin(
			countryRelations,
			and(
				// unit↔unit relations are document-level; the consortium is pinned to its published version.
				eq(countryRelations.unitDocumentId, schema.entityVersions.entityId),
				sql`${countryRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		)
		.leftJoin(countryRelationStatus, eq(countryRelations.status, countryRelationStatus.id))
		.leftJoin(
			countryLifecycle,
			and(
				eq(countryLifecycle.documentId, countryRelations.relatedUnitDocumentId),
				eq(countryRelationStatus.status, "is_national_consortium_of"),
			),
		)
		.leftJoin(countries, eq(countries.id, countryLifecycle.publishedId))
		.leftJoin(countryTypes, eq(countries.typeId, countryTypes.id))
		.leftJoin(countryEntities, eq(countryEntities.id, countryLifecycle.documentId));
}

function mapNationalConsortiumRow(row: NationalConsortiumRow) {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		acronym: row.acronym,
		country:
			row.countryId != null &&
			row.countryName != null &&
			row.countrySlug != null &&
			row.countryType === "country"
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

export async function getNationalConsortia(
	db: Database | Transaction,
	params: GetNationalConsortiaParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		fromNationalConsortia(db)
			.where(nationalConsortiumFilter)
			.orderBy(desc(schema.entityVersions.updatedAt))
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
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(nationalConsortiumFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;
	const data = items.map(mapNationalConsortiumRow);

	return { data, limit, offset, total };
}

interface GetNationalConsortiumByIdParams {
	id: schema.OrganisationalUnit["id"];
}

export async function getNationalConsortiumById(
	db: Database | Transaction,
	params: GetNationalConsortiumByIdParams,
) {
	const { id } = params;

	const item = await fromNationalConsortia(db)
		.where(and(nationalConsortiumFilter, eq(schema.organisationalUnits.id, id)))
		.limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapNationalConsortiumRow(row);
}

export async function getNationalConsortiumSlugs(
	db: Database | Transaction,
	params: GetNationalConsortiaParams,
) {
	const { limit = 10, offset = 0 } = params;

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
				slug: consortiumEntities.slug,
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
			.innerJoin(consortiumEntities, eq(schema.entityVersions.entityId, consortiumEntities.id))
			.where(nationalConsortiumFilter)
			.orderBy(desc(schema.entityVersions.updatedAt))
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
				eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
			)
			.where(nationalConsortiumFilter),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	return { data: items, limit, offset, total };
}

interface GetNationalConsortiumBySlugParams {
	slug: schema.Entity["slug"];
}

export async function getNationalConsortiumBySlug(
	db: Database | Transaction,
	params: GetNationalConsortiumBySlugParams,
) {
	const { slug } = params;

	const item = await fromNationalConsortia(db)
		.where(and(nationalConsortiumFilter, eq(consortiumEntities.slug, slug)))
		.limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapNationalConsortiumRow(row);
}
