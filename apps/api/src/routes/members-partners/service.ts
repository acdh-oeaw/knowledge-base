/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";

import { type ContentBlock, getContentBlocks } from "@/lib/content-blocks";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { resolveLocaleContext } from "@/lib/locales";
import { getPersonPositions } from "@/lib/persons";
import { getRelatedEntities, getRelatedResources, resolveDocumentId } from "@/lib/relations";
import { mapSocialMedia } from "@/lib/social-media";
import type { Database, Transaction } from "@/middlewares/db";
import {
	type SQLWrapper,
	alias,
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	inArray,
	sql,
} from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface MembersAndPartnersContext {
	localeId: string;
	defaultLocaleId: string;
	statusId: string;
}

/**
 * Resolve the locale to prefer (falling back to the default locale) and the `published` entity
 * status id, shared across the base country lookup and every nested institution/consortium/person
 * lookup below — `entityStatus` is entity-type-agnostic, so this is resolved once per request.
 */
async function resolveMembersAndPartnersContext(
	db: Database | Transaction,
	requestedLocaleId?: string,
): Promise<MembersAndPartnersContext> {
	const [{ localeId, defaultLocaleId }, status] = await Promise.all([
		resolveLocaleContext(db, requestedLocaleId),
		db.query.entityStatus.findFirst({ where: { type: "published" }, columns: { id: true } }),
	]);

	assert(status, "No published entity status in database.");

	return { localeId, defaultLocaleId, statusId: status.id };
}

/**
 * The `members_and_partners` DB view (member/observer countries related directly to a DARIAH-EU
 * ERIC unit, plus countries whose located-in institutions hold a cooperating-partner relation) has
 * no locale awareness — it's a static view and can't take the request's preferred locale as a
 * parameter, and it returns one row per (country, locale) pair rather than one per document. Its
 * classification logic (which countries qualify, and their status) is document-level and therefore
 * locale-independent, so it's safe to reuse as-is for _eligibility_; we just collapse it down to
 * distinct (document, status) pairs here and resolve locale-preferred _display_ data separately.
 */
function eligibleMembersAndPartners(db: Database | Transaction) {
	const versions = alias(schema.entityVersions, "eligible_mp_versions");

	return db
		.selectDistinct({
			entityId: versions.entityId,
			status: schema.membersAndPartners.status,
		})
		.from(schema.membersAndPartners)
		.innerJoin(versions, eq(versions.id, schema.membersAndPartners.id))
		.as("eligible_members_and_partners");
}

function fromMembersAndPartners(db: Database | Transaction, ctx: MembersAndPartnersContext) {
	const eligible = eligibleMembersAndPartners(db);
	const preferredVersion = alias(schema.entityVersions, "mp_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "mp_default_version");

	return db
		.select({
			id: schema.organisationalUnits.id,
			metadata: schema.organisationalUnits.metadata,
			name: schema.organisationalUnits.name,
			summary: schema.organisationalUnits.summary,
			sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
			status: eligible.status,
			updatedAt: schema.entityVersions.updatedAt,
			slug: schema.slugs.value,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
		})
		.from(eligible)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, eligible.entityId),
				eq(preferredVersion.localeId, ctx.localeId),
				eq(preferredVersion.statusId, ctx.statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, eligible.entityId),
				eq(defaultVersion.localeId, ctx.defaultLocaleId),
				eq(defaultVersion.statusId, ctx.statusId),
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
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId));
}

interface MembersAndPartnersRow {
	id: string;
	metadata: unknown;
	name: string;
	summary: string | null;
	sshocMarketplaceActorId: number | null;
	status: (typeof schema.membersAndPartnersUnitStatusEnum)[number] | null;
	updatedAt: Date;
	slug: string;
	imageKey: string | null;
	imageAlt: string | null;
	imageCaption: string | null;
	licenseName: string | null;
	licenseUrl: string | null;
}

function rowImage(row: MembersAndPartnersRow, size: number) {
	return generateImageUrl(
		toImageAsset({
			key: row.imageKey,
			alt: row.imageAlt,
			caption: row.imageCaption,
			licenseName: row.licenseName,
			licenseUrl: row.licenseUrl,
		}),
		size,
	);
}

/**
 * Batched, per-organisational-unit-version social media lookup (organisational units are a to-many
 * relation, so this can't be folded into the flat row selects above without fanning them out).
 * Reused for the base country/institution/consortium's own social media as well as pulling just the
 * "website" entry off institutions and the national consortium.
 */
async function getSocialMediaByOrganisationalUnitIds(
	db: Database | Transaction,
	organisationalUnitIds: Array<string>,
) {
	const map = new Map<
		string,
		Array<{
			id: string;
			name: string;
			url: string;
			duration: schema.SocialMedia["duration"];
			type: { type: (typeof schema.socialMediaTypesEnum)[number] };
		}>
	>();

	if (organisationalUnitIds.length === 0) {
		return map;
	}

	const rows = await db
		.select({
			organisationalUnitId: schema.organisationalUnitsToSocialMedia.organisationalUnitId,
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
			duration: schema.socialMedia.duration,
			type: schema.socialMediaTypes.type,
		})
		.from(schema.organisationalUnitsToSocialMedia)
		.innerJoin(
			schema.socialMedia,
			eq(schema.socialMedia.id, schema.organisationalUnitsToSocialMedia.socialMediaId),
		)
		.innerJoin(schema.socialMediaTypes, eq(schema.socialMediaTypes.id, schema.socialMedia.typeId))
		.where(
			inArray(schema.organisationalUnitsToSocialMedia.organisationalUnitId, organisationalUnitIds),
		);

	for (const row of rows) {
		const items = map.get(row.organisationalUnitId) ?? [];
		items.push({
			id: row.id,
			name: row.name,
			url: row.url,
			duration: row.duration,
			type: { type: row.type },
		});
		map.set(row.organisationalUnitId, items);
	}

	return map;
}

function findWebsite(
	socialMedia: Array<{ url: string; type: { type: string } }> | undefined,
): string | null {
	return socialMedia?.find((sm) => sm.type.type === "website")?.url ?? null;
}

//

function mapPersonContributors(
	rows: Array<{
		id: string;
		name: string;
		slug: string;
		imageKey: string | null;
		imageAlt: string | null;
		imageCaption: string | null;
		licenseName: string | null;
		licenseUrl: string | null;
		role: string;
	}>,
	positions: Map<string, Array<{ role: string; name: string; type: string }> | null>,
) {
	return rows.map(({ imageKey, imageAlt, imageCaption, licenseName, licenseUrl, role, ...row }) => {
		return {
			...row,
			position: positions.get(row.id) ?? null,
			role,
			slug: row.slug,
			image: generateImageUrl(
				toImageAsset({
					key: imageKey,
					alt: imageAlt,
					caption: imageCaption,
					licenseName,
					licenseUrl,
				}),
				imageWidth.avatar,
			),
		};
	});
}

function hasContent(block: ContentBlock): boolean {
	switch (block.type) {
		case "rich_text": {
			return hasRichTextContent(block.content);
		}
		case "accordion": {
			return block.items.length > 0;
		}
		case "hero": {
			return (
				block.title.trim().length > 0 ||
				(block.eyebrow?.trim().length ?? 0) > 0 ||
				block.image != null ||
				(block.ctas?.length ?? 0) > 0
			);
		}
		case "data":
		case "embed":
		case "image": {
			return true;
		}
	}
}

function hasRichTextContent(content: unknown): boolean {
	if (typeof content === "string") {
		return content.trim().length > 0;
	}

	if (Array.isArray(content)) {
		return content.some((item) => hasRichTextContent(item));
	}

	if (content != null && typeof content === "object") {
		const value = content as { content?: unknown; text?: unknown };

		if (typeof value.text === "string") {
			return value.text.trim().length > 0;
		}

		return hasRichTextContent(value.content);
	}

	return false;
}

function hasContentBlocks(blocks: Array<ContentBlock> | undefined): blocks is Array<ContentBlock> {
	return blocks?.some((block) => hasContent(block)) === true;
}

type RelationStatus =
	| "is_member_of"
	| "is_observer_of"
	| "is_partner_institution_of"
	| "is_national_coordinating_institution_in"
	| "is_national_representative_institution_in"
	| "is_located_in"
	| "is_national_consortium_of"
	| "is_cooperating_partner_of";

/** Document-level, locale-independent relation checks — unaffected by locale preference. */
function buildActiveRelationExistsFilter(
	db: Database | Transaction,
	idRef: string | SQLWrapper,
	status: RelationStatus | Array<RelationStatus>,
	relatedType: "eric" | "country",
) {
	const durationContainsNow = sql`
		${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ
	`;

	// Unit↔unit relations are document-level; the related unit is resolved from its document id to
	// any of its versions to check the related type. idRef is a version id of the owning unit.
	const relatedUnitVersion = alias(schema.entityVersions, "exists_related_unit_version");
	const relatedSlug = alias(schema.slugs, "exists_related_slug");

	return exists(
		db
			.select({ one: sql<number>`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
			)
			.innerJoin(
				relatedUnitVersion,
				eq(relatedUnitVersion.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.innerJoin(relatedSlug, eq(relatedSlug.entityVersionId, relatedUnitVersion.id))
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, relatedUnitVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${idRef})`,
					Array.isArray(status)
						? inArray(schema.organisationalUnitStatus.status, status)
						: eq(schema.organisationalUnitStatus.status, status),
					eq(schema.organisationalUnitTypes.type, relatedType),
					relatedType === "eric" ? eq(relatedSlug.value, "dariah-eu") : undefined,
					durationContainsNow,
				),
			),
	);
}

function buildActiveRelationToUnitFilter(
	db: Database | Transaction,
	idRef: string | SQLWrapper,
	status: RelationStatus,
	relatedType: "eric" | "country",
	relatedUnitId: string | SQLWrapper,
) {
	const durationContainsNow = sql`
		${schema.organisationalUnitsRelations.duration} @> NOW()::TIMESTAMPTZ
	`;

	// Unit↔unit relations are document-level; idRef and relatedUnitId are version ids resolved to
	// their document ids, and the related unit's type is checked via any of its versions.
	const relatedUnitVersion = alias(schema.entityVersions, "exists_to_unit_related_version");
	const relatedSlug = alias(schema.slugs, "exists_to_unit_related_slug");

	return exists(
		db
			.select({ one: sql<number>`1` })
			.from(schema.organisationalUnitsRelations)
			.innerJoin(
				schema.organisationalUnitStatus,
				eq(schema.organisationalUnitsRelations.status, schema.organisationalUnitStatus.id),
			)
			.innerJoin(
				relatedUnitVersion,
				eq(relatedUnitVersion.entityId, schema.organisationalUnitsRelations.relatedUnitDocumentId),
			)
			.innerJoin(relatedSlug, eq(relatedSlug.entityVersionId, relatedUnitVersion.id))
			.innerJoin(
				schema.organisationalUnits,
				eq(schema.organisationalUnits.id, relatedUnitVersion.id),
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
			)
			.where(
				and(
					sql`${schema.organisationalUnitsRelations.unitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${idRef})`,
					sql`${schema.organisationalUnitsRelations.relatedUnitDocumentId} = (SELECT ${schema.entityVersions.entityId} FROM ${schema.entityVersions} WHERE ${schema.entityVersions.id} = ${relatedUnitId})`,
					eq(schema.organisationalUnitStatus.status, status),
					eq(schema.organisationalUnitTypes.type, relatedType),
					relatedType === "eric" ? eq(relatedSlug.value, "dariah-eu") : undefined,
					durationContainsNow,
				),
			),
	);
}

/**
 * Institutions related to `countryVersionId` by `status` (e.g. partner institution, cooperating
 * partner, national coordinating/representative institution), with locale-preferred display data.
 */
async function getInstitutionsByRelation(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
	status: RelationStatus | Array<RelationStatus>,
) {
	const preferredVersion = alias(schema.entityVersions, "inst_by_rel_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "inst_by_rel_default_version");
	// `buildActiveRelationExistsFilter`/`buildActiveRelationToUnitFilter` embed `idRef` inside their
	// own `FROM entity_versions WHERE entity_versions.id = idRef` scalar subquery — passing the bare
	// (unaliased) `schema.entityVersions.id` here would shadow itself inside that subquery (the
	// inner `FROM entity_versions` wins), turning the correlation into a self-referential tautology
	// that matches every row and makes the scalar subquery blow up with "more than one row returned".
	// Aliasing the resolved version keeps it a distinct identifier so it correlates correctly instead.
	const resolvedVersion = alias(schema.entityVersions, "inst_by_rel_resolved_version");
	const institutionSlugs = alias(schema.slugs, "inst_by_rel_slugs");
	const institutionTypes = alias(schema.organisationalUnitTypes, "inst_by_rel_types");

	const rows = await db
		.select({
			id: resolvedVersion.id,
			name: schema.organisationalUnits.name,
			ror: schema.organisationalUnits.ror,
			slug: institutionSlugs.value,
		})
		.from(schema.entities)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, schema.entities.id),
				eq(preferredVersion.localeId, ctx.localeId),
				eq(preferredVersion.statusId, ctx.statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, schema.entities.id),
				eq(defaultVersion.localeId, ctx.defaultLocaleId),
				eq(defaultVersion.statusId, ctx.statusId),
			),
		)
		.innerJoin(
			resolvedVersion,
			sql`${resolvedVersion.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
		)
		.innerJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, resolvedVersion.id))
		.innerJoin(institutionSlugs, eq(institutionSlugs.entityVersionId, resolvedVersion.id))
		.innerJoin(
			institutionTypes,
			and(
				eq(schema.organisationalUnits.typeId, institutionTypes.id),
				eq(institutionTypes.type, "institution"),
			),
		)
		.where(
			and(
				buildActiveRelationExistsFilter(db, resolvedVersion.id, status, "eric"),
				buildActiveRelationToUnitFilter(
					db,
					resolvedVersion.id,
					"is_located_in",
					"country",
					countryVersionId,
				),
			),
		)
		.orderBy(asc(schema.organisationalUnits.name));

	const websites = await getSocialMediaByOrganisationalUnitIds(
		db,
		rows.map((row) => row.id),
	);

	return rows.map((row) => {
		return {
			name: row.name,
			ror: row.ror,
			slug: row.slug,
			website: findWebsite(websites.get(row.id)),
		};
	});
}

function getPartnerInstitutions(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
) {
	return getInstitutionsByRelation(db, ctx, countryVersionId, "is_partner_institution_of");
}

function getCooperatingPartnerInstitutions(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
) {
	return getInstitutionsByRelation(db, ctx, countryVersionId, "is_cooperating_partner_of");
}

async function getNationalCoordinatingInstitution(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
) {
	const items = await getInstitutionsByRelation(
		db,
		ctx,
		countryVersionId,
		"is_national_coordinating_institution_in",
	);
	return items.at(0) ?? null;
}

async function getNationalRepresentativeInstitution(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
) {
	const items = await getInstitutionsByRelation(
		db,
		ctx,
		countryVersionId,
		"is_national_representative_institution_in",
	);
	return items.at(0) ?? null;
}

async function getNationalConsortium(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
	options?: { imageSize?: number; includeDescription?: boolean },
) {
	const preferredVersion = alias(schema.entityVersions, "consortium_by_country_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "consortium_by_country_default_version");
	// See the comment in `getInstitutionsByRelation`: `buildActiveRelationToUnitFilter` embeds `idRef`
	// inside its own `FROM entity_versions` scalar subquery, so the bare (unaliased) entityVersions
	// join here would shadow itself there instead of correlating — alias it to keep it distinct.
	const resolvedVersion = alias(schema.entityVersions, "consortium_by_country_resolved_version");
	const consortiumSlugs = alias(schema.slugs, "consortium_by_country_slugs");
	const consortiumTypes = alias(schema.organisationalUnitTypes, "consortium_by_country_types");

	const rows = await db
		.select({
			id: resolvedVersion.id,
			name: schema.organisationalUnits.name,
			ror: schema.organisationalUnits.ror,
			slug: consortiumSlugs.value,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
		})
		.from(schema.entities)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, schema.entities.id),
				eq(preferredVersion.localeId, ctx.localeId),
				eq(preferredVersion.statusId, ctx.statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, schema.entities.id),
				eq(defaultVersion.localeId, ctx.defaultLocaleId),
				eq(defaultVersion.statusId, ctx.statusId),
			),
		)
		.innerJoin(
			resolvedVersion,
			sql`${resolvedVersion.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
		)
		.innerJoin(schema.organisationalUnits, eq(schema.organisationalUnits.id, resolvedVersion.id))
		.innerJoin(consortiumSlugs, eq(consortiumSlugs.entityVersionId, resolvedVersion.id))
		.innerJoin(
			consortiumTypes,
			and(
				eq(schema.organisationalUnits.typeId, consortiumTypes.id),
				eq(consortiumTypes.type, "national_consortium"),
			),
		)
		.leftJoin(schema.assets, eq(schema.organisationalUnits.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.where(
			buildActiveRelationToUnitFilter(
				db,
				resolvedVersion.id,
				"is_national_consortium_of",
				"country",
				countryVersionId,
			),
		)
		.limit(1);

	const row = rows.at(0);

	if (row == null) {
		return null;
	}

	const [fields, websites] = await Promise.all([
		options?.includeDescription === true ? getContentBlocks(db, row.id) : Promise.resolve({}),
		getSocialMediaByOrganisationalUnitIds(db, [row.id]),
	]);

	return {
		name: row.name,
		slug: row.slug,
		ror: row.ror,
		website: findWebsite(websites.get(row.id)),
		image: generateImageUrl(
			toImageAsset({
				key: row.imageKey,
				alt: row.imageAlt,
				caption: row.imageCaption,
				licenseName: row.licenseName,
				licenseUrl: row.licenseUrl,
			}),
			options?.imageSize ?? imageWidth.preview,
		),
		description: (fields as { description?: Array<ContentBlock> }).description,
	};
}

async function getContributors(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	countryVersionId: string,
) {
	// countryVersionId is a resolved published org version id; resolve it to its document id once.
	const countryDocumentId = await resolveDocumentId(db, countryVersionId);

	const preferredVersion = alias(schema.entityVersions, "contributor_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "contributor_default_version");
	const contributorSlugs = alias(schema.slugs, "contributor_slugs");

	const rows = await db
		.select({
			id: schema.entityVersions.id,
			name: schema.persons.name,
			slug: contributorSlugs.value,
			imageKey: schema.assets.key,
			imageAlt: schema.assets.alt,
			imageCaption: schema.assets.caption,
			licenseName: schema.licenses.name,
			licenseUrl: schema.licenses.url,
			role: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.leftJoin(
			preferredVersion,
			and(
				eq(preferredVersion.entityId, schema.personsToOrganisationalUnits.personDocumentId),
				eq(preferredVersion.localeId, ctx.localeId),
				eq(preferredVersion.statusId, ctx.statusId),
			),
		)
		.leftJoin(
			defaultVersion,
			and(
				eq(defaultVersion.entityId, schema.personsToOrganisationalUnits.personDocumentId),
				eq(defaultVersion.localeId, ctx.defaultLocaleId),
				eq(defaultVersion.statusId, ctx.statusId),
			),
		)
		.innerJoin(
			schema.entityVersions,
			sql`${schema.entityVersions.id} = COALESCE(${preferredVersion.id}, ${defaultVersion.id})`,
		)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.entityVersions.id))
		.innerJoin(contributorSlugs, eq(contributorSlugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(schema.assets, eq(schema.persons.imageId, schema.assets.id))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, countryDocumentId),
				sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
				sql`
					${schema.personRoleTypes.type} IN (
						'national_coordinator',
						'national_coordinator_deputy',
						'national_representative',
						'national_representative_deputy'
					)
				`,
			),
		);

	// national_coordinator(_deputy) and national_representative(_deputy) are non-exclusive: a person may
	// legitimately hold a coordinator and a representative relation, and should then be listed once per
	// role. Collapse only exact duplicates (same person and role) so a stray duplicate relation row
	// cannot list the same contributor twice with an identical role.
	const rowsByPersonAndRole = new Map<string, (typeof rows)[number]>();
	for (const row of rows) {
		const key = `${row.id}:${row.role}`;
		if (!rowsByPersonAndRole.has(key)) {
			rowsByPersonAndRole.set(key, row);
		}
	}

	const contributors = [...rowsByPersonAndRole.values()].toSorted((a, b) => {
		const byName = a.name.localeCompare(b.name);
		if (byName !== 0) {
			return byName;
		}
		const byRole = a.role.localeCompare(b.role);
		if (byRole !== 0) {
			return byRole;
		}
		return a.id.localeCompare(b.id);
	});

	const positions = await getPersonPositions(db, [...new Set(contributors.map((row) => row.id))]);

	return mapPersonContributors(contributors, positions);
}

//

async function buildMemberOrPartnerDetail(
	db: Database | Transaction,
	ctx: MembersAndPartnersContext,
	item: MembersAndPartnersRow,
) {
	const status = item.status;
	assert(status, `Members-and-partners status missing for document version "${item.id}".`);

	const [fields, relatedEntities, relatedResources, socialMediaMap] = await Promise.all([
		getContentBlocks(db, item.id),
		getRelatedEntities(db, item.id),
		getRelatedResources(db, item.id),
		getSocialMediaByOrganisationalUnitIds(db, [item.id]),
	]);

	const base = {
		id: item.id,
		metadata: item.metadata,
		name: item.name,
		summary: item.summary,
		sshocMarketplaceActorId: item.sshocMarketplaceActorId,
		type: schema.membersAndPartnersUnitType,
		entity: { slug: item.slug },
		publishedAt: item.updatedAt.toISOString(),
		socialMedia: mapSocialMedia(socialMediaMap.get(item.id) ?? []),
		...fields,
		relatedEntities,
		relatedResources,
	};

	if (status === "is_member_of" || status === "is_observer_of") {
		const [
			institutions,
			contributors,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		] = await Promise.all([
			getPartnerInstitutions(db, ctx, item.id),
			getContributors(db, ctx, item.id),
			getNationalCoordinatingInstitution(db, ctx, item.id),
			getNationalRepresentativeInstitution(db, ctx, item.id),
			getNationalConsortium(db, ctx, item.id, {
				imageSize: imageWidth.featured,
				includeDescription: true,
			}),
		]);

		const image = nationalConsortium?.image ?? rowImage(item, imageWidth.featured);
		const description = hasContentBlocks(nationalConsortium?.description)
			? nationalConsortium.description
			: fields.description;

		return {
			...base,
			status,
			image,
			description,
			contributors,
			institutions,
			nationalCoordinatingInstitution,
			nationalRepresentativeInstitution,
			nationalConsortium,
		};
	}

	return {
		...base,
		status,
		image: rowImage(item, imageWidth.featured),
		institutions: await getCooperatingPartnerInstitutions(db, ctx, item.id),
	};
}

//

interface GetMembersAndPartnersParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getMembersAndPartners(
	db: Database | Transaction,
	params: GetMembersAndPartnersParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const ctx = await resolveMembersAndPartnersContext(db, requestedLocaleId);

	const [items, aggregate] = await Promise.all([
		fromMembersAndPartners(db, ctx)
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(eligibleMembersAndPartners(db)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const socialMediaMap = await getSocialMediaByOrganisationalUnitIds(
		db,
		items.map((item) => item.id),
	);

	const data = await Promise.all(
		items.map(async (item) => {
			const status = item.status;
			assert(status, `Members-and-partners status missing for document version "${item.id}".`);

			const nationalConsortium =
				status === "is_member_of" || status === "is_observer_of"
					? await getNationalConsortium(db, ctx, item.id)
					: null;

			const image = nationalConsortium?.image ?? rowImage(item, imageWidth.preview);
			const socialMedia = mapSocialMedia(socialMediaMap.get(item.id) ?? []);

			return {
				id: item.id,
				metadata: item.metadata,
				name: item.name,
				summary: item.summary,
				sshocMarketplaceActorId: item.sshocMarketplaceActorId,
				status,
				type: schema.membersAndPartnersUnitType,
				entity: { slug: item.slug },
				publishedAt: item.updatedAt.toISOString(),
				image,
				socialMedia,
			};
		}),
	);

	return { data, limit, offset, total };
}

//

interface GetMemberOrPartnerByIdParams {
	id: schema.OrganisationalUnit["id"];
	localeId?: string;
}

export async function getMemberOrPartnerById(
	db: Database | Transaction,
	params: GetMemberOrPartnerByIdParams,
) {
	const { id, localeId: requestedLocaleId } = params;
	const ctx = await resolveMembersAndPartnersContext(db, requestedLocaleId);

	const item = (
		await fromMembersAndPartners(db, ctx).where(eq(schema.organisationalUnits.id, id)).limit(1)
	).at(0);

	if (item == null) {
		return null;
	}

	return buildMemberOrPartnerDetail(db, ctx, item);
}

//

interface GetMemberOrPartnerSlugsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	localeId?: string;
}

export async function getMemberOrPartnerSlugs(
	db: Database | Transaction,
	params: GetMemberOrPartnerSlugsParams,
) {
	const { limit = 10, offset = 0, localeId: requestedLocaleId } = params;
	const ctx = await resolveMembersAndPartnersContext(db, requestedLocaleId);

	const eligible = eligibleMembersAndPartners(db);
	const preferredVersion = alias(schema.entityVersions, "mp_slugs_preferred_version");
	const defaultVersion = alias(schema.entityVersions, "mp_slugs_default_version");

	const [items, aggregate] = await Promise.all([
		db
			.select({
				id: schema.organisationalUnits.id,
				slug: schema.slugs.value,
			})
			.from(eligible)
			.leftJoin(
				preferredVersion,
				and(
					eq(preferredVersion.entityId, eligible.entityId),
					eq(preferredVersion.localeId, ctx.localeId),
					eq(preferredVersion.statusId, ctx.statusId),
				),
			)
			.leftJoin(
				defaultVersion,
				and(
					eq(defaultVersion.entityId, eligible.entityId),
					eq(defaultVersion.localeId, ctx.defaultLocaleId),
					eq(defaultVersion.statusId, ctx.statusId),
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
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.orderBy(desc(schema.entityVersions.updatedAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(eligibleMembersAndPartners(db)),
	]);

	const total = aggregate.at(0)?.total ?? 0;

	const data = items.map(({ id, slug }) => {
		return { id, entity: { slug } };
	});

	return { data, limit, offset, total };
}

//

interface GetMemberOrPartnerBySlugParams {
	slug: schema.Slug["value"];
	localeId?: string;
}

export async function getMemberOrPartnerBySlug(
	db: Database | Transaction,
	params: GetMemberOrPartnerBySlugParams,
) {
	const { slug, localeId: requestedLocaleId } = params;
	const ctx = await resolveMembersAndPartnersContext(db, requestedLocaleId);

	const item = (
		await fromMembersAndPartners(db, ctx).where(eq(schema.slugs.value, slug)).limit(1)
	).at(0);

	if (item == null) {
		return null;
	}

	return buildMemberOrPartnerDetail(db, ctx, item);
}
