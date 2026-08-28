/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, count, desc, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

/**
 * Resolve, per national consortium document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedNationalConsortiaLookup(
	db: Database | Transaction,
	requestedLocaleId?: string,
) {
	const [{ localeId, defaultLocaleId }, entityType, consortiumType, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityTypes.findFirst({
			where: { type: "organisational_units" },
			columns: { id: true },
		}),
		db.query.organisationalUnitTypes.findFirst({
			where: { type: "national_consortium" },
			columns: { id: true },
		}),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(entityType, "No organisational_units entity type in database.");
	assert(consortiumType, "No national_consortium type in database.");
	assert(status, "No published entity status in database.");

	const preferredVersion = alias(schema.entityVersions, "consortium_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "consortium_default_version");
	const countryPreferredVersion = alias(schema.entityVersions, "country_preferred_version");
	const countryDefaultVersion = alias(schema.entityVersions, "country_default_version");

	return {
		localeId,
		defaultLocaleId,
		entityTypeId: entityType.id,
		consortiumTypeId: consortiumType.id,
		statusId: status.id,
		preferredVersion,
		defaultVersion,
		countryPreferredVersion,
		countryDefaultVersion,
	};
}

const countryRelations = alias(schema.organisationalUnitsRelations, "country_relations");
const countryRelationStatus = alias(schema.organisationalUnitStatus, "country_relation_status");
const countries = alias(schema.organisationalUnits, "countries");
const countryTypes = alias(schema.organisationalUnitTypes, "country_types");
const countrySlugs = alias(schema.slugs, "country_slugs");
const consortiumSlugs = alias(schema.slugs, "consortium_slugs");

function selectNationalConsortiumRows() {
	return {
		id: schema.organisationalUnits.id,
		name: schema.organisationalUnits.name,
		acronym: schema.organisationalUnits.acronym,
		slug: consortiumSlugs.value,
		logoKey: schema.assets.key,
		logoWidth: schema.assets.width,
		logoHeight: schema.assets.height,
		logoAlt: schema.assets.alt,
		logoCaption: schema.assets.caption,
		licenseName: schema.licenses.name,
		licenseUrl: schema.licenses.url,
		countryId: countries.id,
		countryName: countries.name,
		countrySlug: countrySlugs.value,
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
	logoWidth: number | null;
	logoHeight: number | null;
	logoAlt: string | null;
	logoCaption: JSONContent | null;
	licenseName: string | null;
	licenseUrl: string | null;
	countryId: string | null;
	countryName: string | null;
	countrySlug: string | null;
	countryType: (typeof schema.organisationalUnitTypesEnum)[number] | null;
	updatedAt: Date;
}

function fromNationalConsortia(
	db: Database | Transaction,
	ctx: Awaited<ReturnType<typeof resolvePublishedNationalConsortiaLookup>>,
) {
	const query = db
		.select(selectNationalConsortiumRows())
		.from(schema.entities)
		.leftJoin(
			ctx.preferredVersion,
			and(
				eq(ctx.preferredVersion.entityId, schema.entities.id),
				eq(ctx.preferredVersion.localeId, ctx.localeId),
				eq(ctx.preferredVersion.statusId, ctx.statusId),
			),
		)
		.leftJoin(
			ctx.defaultVersion,
			and(
				eq(ctx.defaultVersion.entityId, schema.entities.id),
				eq(ctx.defaultVersion.localeId, ctx.defaultLocaleId),
				eq(ctx.defaultVersion.statusId, ctx.statusId),
			),
		)
		.innerJoin(
			schema.entityVersions,
			sql`${schema.entityVersions.id} = COALESCE(${ctx.preferredVersion.id}, ${ctx.defaultVersion.id})`,
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.entityVersions.id),
		)
		.innerJoin(consortiumSlugs, eq(consortiumSlugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.leftJoin(
			countryRelations,
			and(
				// unit↔unit relations are document-level; the consortium is pinned to its published version.
				eq(countryRelations.unitDocumentId, schema.entities.id),
				sql`${countryRelations.duration} @> NOW()::TIMESTAMPTZ`,
			),
		)
		.leftJoin(countryRelationStatus, eq(countryRelations.status, countryRelationStatus.id))
		.leftJoin(
			ctx.countryPreferredVersion,
			and(
				eq(ctx.countryPreferredVersion.entityId, countryRelations.relatedUnitDocumentId),
				eq(ctx.countryPreferredVersion.localeId, ctx.localeId),
				eq(ctx.countryPreferredVersion.statusId, ctx.statusId),
				eq(countryRelationStatus.status, "is_national_consortium_of"),
			),
		)
		.leftJoin(
			ctx.countryDefaultVersion,
			and(
				eq(ctx.countryDefaultVersion.entityId, countryRelations.relatedUnitDocumentId),
				eq(ctx.countryDefaultVersion.localeId, ctx.defaultLocaleId),
				eq(ctx.countryDefaultVersion.statusId, ctx.statusId),
				eq(countryRelationStatus.status, "is_national_consortium_of"),
			),
		)
		.leftJoin(
			countries,
			sql`${countries.id} = COALESCE(${ctx.countryPreferredVersion.id}, ${ctx.countryDefaultVersion.id})`,
		)
		.leftJoin(countryTypes, eq(countries.typeId, countryTypes.id))
		.leftJoin(countrySlugs, eq(countrySlugs.entityVersionId, countries.id));

	const baseFilter = and(
		eq(schema.entities.typeId, ctx.entityTypeId),
		eq(schema.organisationalUnits.typeId, ctx.consortiumTypeId),
	);

	return { query, baseFilter };
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
				width: row.logoWidth,
				height: row.logoHeight,
				licenseName: row.licenseName,
				licenseUrl: row.licenseUrl,
			}),
			imageWidth.preview,
		),
	};
}

interface GetNationalConsortiaParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getNationalConsortia(
	db: Database | Transaction,
	params: GetNationalConsortiaParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const ctx = await resolvePublishedNationalConsortiaLookup(db, requestedLocaleId);
	const { query, baseFilter } = fromNationalConsortia(db, ctx);

	const [items, aggregate] = await Promise.all([
		query
			.where(baseFilter)
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
			.where(eq(schema.organisationalUnitTypes.type, "national_consortium")),
	]);

	const total = aggregate.at(0)?.total ?? 0;
	const data = items.map(mapNationalConsortiumRow);

	return { data, limit, offset, total };
}

interface GetNationalConsortiumByIdParams {
	id: schema.OrganisationalUnit["id"];
	localeId?: string;
}

export async function getNationalConsortiumById(
	db: Database | Transaction,
	params: GetNationalConsortiumByIdParams,
) {
	const { id, localeId: requestedLocaleId } = params;
	const ctx = await resolvePublishedNationalConsortiaLookup(db, requestedLocaleId);
	const { query, baseFilter } = fromNationalConsortia(db, ctx);

	const item = await query.where(and(baseFilter, eq(schema.organisationalUnits.id, id))).limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapNationalConsortiumRow(row);
}

interface GetNationalConsortiumSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getNationalConsortiumSlugs(
	db: Database | Transaction,
	params: GetNationalConsortiumSlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const {
		localeId,
		defaultLocaleId,
		entityTypeId,
		consortiumTypeId,
		statusId,
		preferredVersion,
		defaultVersion,
	} = await resolvePublishedNationalConsortiaLookup(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
				slug: consortiumSlugs.value,
			})
			.from(schema.entities)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, schema.entities.id),
					eq(preferredVersion.localeId, localeId),
					eq(preferredVersion.statusId, statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, schema.entities.id),
					eq(defaultVersion.localeId, defaultLocaleId),
					eq(defaultVersion.statusId, statusId),
				),
			)
			.innerJoin(
				schema.entityVersions,
				sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
			)
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, schema.entityVersions.id),
			)
			.innerJoin(consortiumSlugs, eq(consortiumSlugs.entityVersionId, schema.entityVersions.id))
			.where(
				and(
					eq(schema.entities.typeId, entityTypeId),
					eq(schema.organisationalUnits.typeId, consortiumTypeId),
				),
			)
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
			.where(eq(schema.organisationalUnitTypes.type, "national_consortium")),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	return { data: items, limit, offset, total };
}

interface GetNationalConsortiumBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getNationalConsortiumBySlug(
	db: Database | Transaction,
	params: GetNationalConsortiumBySlugParams,
) {
	const { slug, localeId: requestedLocaleId } = params;
	const ctx = await resolvePublishedNationalConsortiaLookup(db, requestedLocaleId);
	const { query, baseFilter } = fromNationalConsortia(db, ctx);

	const item = await query.where(and(baseFilter, eq(consortiumSlugs.value, slug))).limit(1);

	const row = item.at(0);

	if (row == null) {
		return null;
	}

	return mapNationalConsortiumRow(row);
}
