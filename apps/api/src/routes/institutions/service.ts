/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";
import { assert } from "@acdh-oeaw/lib";

import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
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
 * any other unit of type `eric`. This is an identity check, not a display value, so it's always
 * matched against the default locale's slug regardless of the requested locale.
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

/**
 * Resolve, per institution document, the published version to prefer: the requested/default
 * locale's published version, falling back to the default locale's when the document has no version
 * in the preferred locale. `localeId === defaultLocaleId` (the no-locale-requested case) still
 * works correctly here — both joins target the same locale and `COALESCE` just picks the
 * (identical) match.
 */
async function resolvePublishedInstitutionsLookup(
  db: Database | Transaction,
  requestedLocaleId?: string,
) {
  const [{ localeId, defaultLocaleId }, entityType, institutionType, status] = await Promise.all([
    resolveLocaleContext(db, requestedLocaleId),
    db.query.entityTypes.findFirst({
      where: { type: "organisational_units" },
      columns: { id: true },
    }),
    db.query.organisationalUnitTypes.findFirst({
      where: { type: "institution" },
      columns: { id: true },
    }),
    db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
  ]);

  assert(entityType, "No organisational_units entity type in database.");
  assert(institutionType, "No institution type in database.");
  assert(status, "No published entity status in database.");

  const preferredVersion = alias(schema.entityVersions, "institutions_preferred_version");
  const defaultVersion = alias(schema.entityVersions, "institutions_default_version");

  return {
    localeId,
    defaultLocaleId,
    entityTypeId: entityType.id,
    institutionTypeId: institutionType.id,
    statusId: status.id,
    preferredVersion,
    defaultVersion,
  };
}

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
  const ericSlugs = alias(schema.slugs, "eric_slugs");

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
      ericSlugs,
      and(eq(ericSlugs.entityVersionId, lifecycle.publishedId), eq(ericSlugs.value, dariahEuSlug)),
    )
    .innerJoin(eric, eq(eric.id, lifecycle.publishedId))
    .innerJoin(ericTypes, and(eq(eric.typeId, ericTypes.id), eq(ericTypes.type, "eric")))
    .where(sql`${relations.duration} @> NOW()::TIMESTAMPTZ`)
    .as("eric_relation");
}

/**
 * Resolves, per institution document, the country it is located in (`is_located_in`), preferring
 * the requested locale's published version and falling back to the default locale's — same COALESCE
 * pattern as the institution's own lookup. Pre-filtered in a subquery for the same single-row
 * reason as {@link ericRelationSubquery}.
 */
function countryRelationSubquery(
  db: Database | Transaction,
  localeId: string,
  defaultLocaleId: string,
  statusId: string,
) {
  const relations = alias(schema.organisationalUnitsRelations, "country_relations");
  const relationStatus = alias(schema.organisationalUnitStatus, "country_relation_status");
  const preferredVersion = alias(schema.entityVersions, "country_relation_preferred_version");
  const defaultVersion = alias(schema.entityVersions, "country_relation_default_version");
  const countries = alias(schema.organisationalUnits, "countries");
  const countryTypes = alias(schema.organisationalUnitTypes, "country_types");
  const countrySlugs = alias(schema.slugs, "country_slugs");

  return db
    .select({
      unitDocumentId: relations.unitDocumentId,
      countryId: countries.id,
      countryName: countries.name,
      countrySlug: countrySlugs.value,
    })
    .from(relations)
    .innerJoin(
      relationStatus,
      and(eq(relations.status, relationStatus.id), eq(relationStatus.status, "is_located_in")),
    )
    .leftJoin(
      preferredVersion,
      and(
        eq(preferredVersion.entityId, relations.relatedUnitDocumentId),
        eq(preferredVersion.localeId, localeId),
        eq(preferredVersion.statusId, statusId),
      ),
    )
    .leftJoin(
      defaultVersion,
      and(
        eq(defaultVersion.entityId, relations.relatedUnitDocumentId),
        eq(defaultVersion.localeId, defaultLocaleId),
        eq(defaultVersion.statusId, statusId),
      ),
    )
    .innerJoin(
      countries,
      sql`${countries.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
    )
    .innerJoin(
      countryTypes,
      and(eq(countries.typeId, countryTypes.id), eq(countryTypes.type, "country")),
    )
    .innerJoin(countrySlugs, eq(countrySlugs.entityVersionId, countries.id))
    .where(sql`${relations.duration} @> NOW()::TIMESTAMPTZ`)
    .as("country_relation");
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

function institutionQuery(
  db: Database | Transaction,
  ctx: Awaited<ReturnType<typeof resolvePublishedInstitutionsLookup>>,
) {
  const ericRelation = ericRelationSubquery(db);
  const countryRelation = countryRelationSubquery(
    db,
    ctx.localeId,
    ctx.defaultLocaleId,
    ctx.statusId,
  );
  const institutionSlugs = alias(schema.slugs, "institution_slugs");

  const query = db
    .select({
      id: schema.organisationalUnits.id,
      name: schema.organisationalUnits.name,
      acronym: schema.organisationalUnits.acronym,
      ror: schema.organisationalUnits.ror,
      slug: institutionSlugs.value,
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
    .innerJoin(institutionSlugs, eq(institutionSlugs.entityVersionId, schema.entityVersions.id))
    .leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
    .leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
    .leftJoin(ericRelation, eq(ericRelation.unitDocumentId, schema.entities.id))
    .leftJoin(countryRelation, eq(countryRelation.unitDocumentId, schema.entities.id));

  const baseFilter = and(
    eq(schema.entities.typeId, ctx.entityTypeId),
    eq(schema.organisationalUnits.typeId, ctx.institutionTypeId),
  );

  return { query, ericRelation, institutionSlugs, baseFilter };
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

  const baseFilter = eq(schema.organisationalUnitTypes.type, "institution");

  return { query, ericRelation, baseFilter };
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
  localeId?: string;
}

export async function getInstitutions(db: Database | Transaction, params: GetInstitutionsParams) {
  const { limit = 10, offset = 0, status, localeId: requestedLocaleId } = params;
  const ctx = await resolvePublishedInstitutionsLookup(db, requestedLocaleId);

  const list = institutionQuery(db, ctx);
  const aggregate = institutionCountQuery(db);

  const [items, totals] = await Promise.all([
    list.query
      .where(and(list.baseFilter, statusFilter(list.ericRelation, status)))
      .orderBy(desc(schema.entityVersions.updatedAt))
      .limit(limit)
      .offset(offset),
    aggregate.query.where(and(aggregate.baseFilter, statusFilter(aggregate.ericRelation, status))),
  ]);

  const total = totals.at(0)?.total ?? 0;
  const data = items.map((row) => mapInstitutionRow(row));

  return { data, limit, offset, total };
}

interface GetInstitutionByIdParams {
  id: schema.OrganisationalUnit["id"];
  localeId?: string;
}

export async function getInstitutionById(
  db: Database | Transaction,
  params: GetInstitutionByIdParams,
) {
  const { id, localeId: requestedLocaleId } = params;
  const ctx = await resolvePublishedInstitutionsLookup(db, requestedLocaleId);

  const { query, baseFilter } = institutionQuery(db, ctx);
  const item = await query.where(and(baseFilter, eq(schema.organisationalUnits.id, id))).limit(1);

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
  localeId?: string;
}

export async function getInstitutionSlugs(
  db: Database | Transaction,
  params: GetInstitutionSlugsParams,
) {
  const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
  const {
    localeId,
    defaultLocaleId,
    entityTypeId,
    institutionTypeId,
    statusId,
    preferredVersion,
    defaultVersion,
  } = await resolvePublishedInstitutionsLookup(db, requestedLocaleId);
  const institutionSlugs = alias(schema.slugs, "institution_slugs");

  const [items, aggregate] = await Promise.all([
    db
      .select({
        id: schema.organisationalUnits.id,
        slug: institutionSlugs.value,
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
      .innerJoin(institutionSlugs, eq(institutionSlugs.entityVersionId, schema.entityVersions.id))
      .where(
        and(
          eq(schema.entities.typeId, entityTypeId),
          eq(schema.organisationalUnits.typeId, institutionTypeId),
        ),
      )
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
      .where(eq(schema.organisationalUnitTypes.type, "institution")),
  ]);

  const total = aggregate.at(0)?.total ?? 0;

  return { data: items, limit, offset, total };
}

interface GetInstitutionBySlugParams {
  slug: schema.Slug["value"];
  localeId?: string;
}

export async function getInstitutionBySlug(
  db: Database | Transaction,
  params: GetInstitutionBySlugParams,
) {
  const { slug, localeId: requestedLocaleId } = params;
  const ctx = await resolvePublishedInstitutionsLookup(db, requestedLocaleId);

  const { query, institutionSlugs, baseFilter } = institutionQuery(db, ctx);
  const item = await query.where(and(baseFilter, eq(institutionSlugs.value, slug))).limit(1);

  const row = item.at(0);

  if (row == null) {
    return null;
  }

  return mapInstitutionRow(row);
}
