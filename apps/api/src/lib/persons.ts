import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import { serializeDateRange } from "@/lib/date-range";
import { type Image, generateImageUrl, toImageAsset, withResolvedCaption } from "@/lib/images";
import { resolveDocumentId } from "@/lib/relations";
import type { EntityRef, PublicRelatedEntityType } from "@/lib/schemas";
import {
	getCountrySlugsByOrganisationalUnitDocumentId,
	getOrganisationalUnitHref,
	getWebsiteHref,
} from "@/lib/website-routes";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, and, eq, inArray, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

export interface PersonSocialMedia {
	type: (typeof schema.personSocialMediaTypesEnum)[number];
	url: string;
	label: string | null;
}

/**
 * A person's own social media, in their stored order. Unlike an organisational unit's social media
 * these are rows owned by the person version rather than entries in the shared `social_media`
 * table, so `position` is a column on the row itself and there is no junction to order by.
 */
export const personSocialMediaQuery = {
	columns: { url: true, label: true },
	with: { type: { columns: { type: true } } },
	orderBy: { position: "asc" },
} as const;

export function mapPersonSocialMedia(
	entries: Array<{ type: { type: string }; url: string; label: string | null }>,
): Array<PersonSocialMedia> {
	return entries.map((entry) => {
		return {
			label: entry.label,
			type: entry.type.type as PersonSocialMedia["type"],
			url: entry.url,
		};
	});
}

export interface PersonPosition {
	role: (typeof schema.personRoleTypesEnum)[number];
	/** Optional free-text note describing the person↔org relation. */
	description: string | null;
	/** The organisational unit the role is held in. */
	entity: EntityRef;
	/**
	 * The period the role is (or was) held for, day granularity. `end` is absent for an open-ended
	 * position, which — for a current position — is the common case.
	 */
	duration: { start: string; end?: string };
}

// Positions are surfaced in a fixed hierarchy of relation types so the order is consistent across
// endpoints: national-consortium roles first, then governance-body roles by seniority, affiliation
// last. A senior role held long ago outranks a minor current one, so the duration only breaks ties
// within a role, and the org-unit name only breaks ties within a duration.
const positionRolePriority: Record<(typeof schema.personRoleTypesEnum)[number], number> = {
	national_coordinator: 0,
	national_coordinator_deputy: 1,
	national_coordination_staff: 2,
	national_representative: 3,
	national_representative_deputy: 4,
	is_chair_of: 5,
	is_vice_chair_of: 6,
	is_member_of: 7,
	is_contact_for: 8,
	is_affiliated_with: 9,
	is_content_manager_for: 10,
};

function comparePositions(a: PersonPosition, b: PersonPosition): number {
	const byRole = positionRolePriority[a.role] - positionRolePriority[b.role];
	if (byRole !== 0) {
		return byRole;
	}

	// Most recent first. An open-ended position outranks one that is scheduled to end, then later end
	// dates, then later start dates. Timestamps are ISO-8601 UTC, so they sort lexicographically.
	if (a.duration.end == null || b.duration.end == null) {
		if (a.duration.end != null) {
			return 1;
		}
		if (b.duration.end != null) {
			return -1;
		}
	} else {
		const byEnd = b.duration.end.localeCompare(a.duration.end);
		if (byEnd !== 0) {
			return byEnd;
		}
	}

	const byStart = b.duration.start.localeCompare(a.duration.start);
	if (byStart !== 0) {
		return byStart;
	}

	return (a.entity.label ?? "").localeCompare(b.entity.label ?? "");
}

export type PersonPositionPeriod = "current" | "former";

interface GetPersonPositionsOptions {
	/**
	 * Which relations to return, relative to now. The two sets are disjoint, so a caller wanting both
	 * calls this twice. Defaults to `current` — embedded person references (article credits, body
	 * memberships) only ever show what a person holds today.
	 */
	when?: PersonPositionPeriod;
}

/**
 * A person's relations to organisational units (`persons_to_organisational_units`), current by
 * default. Distinct from article credits — see `contributors` on the article endpoints.
 */
export async function getPersonPositions(
	db: Database | Transaction,
	personIds: Array<string>,
	options: GetPersonPositionsOptions = {},
): Promise<Map<string, Array<PersonPosition> | null>> {
	const { when = "current" } = options;

	const positions = new Map<string, Array<PersonPosition> | null>();

	for (const personId of personIds) {
		positions.set(personId, null);
	}

	if (personIds.length === 0) {
		return positions;
	}

	// person↔org relations are document-level. `personIds` are published version ids; re-key the
	// relation join through each endpoint's document and resolve the org to its published version.
	const personEntityVersions = alias(schema.entityVersions, "person_entity_versions");
	const organisationalUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"organisational_unit_document_lifecycle",
	);

	// `@>` is "contains now"; `<<` is "strictly left of", i.e. every instant of the duration precedes
	// now. The two are disjoint even for a duration whose (inclusive) upper bound is exactly now, so
	// no relation is ever both current and former.
	const durationFilter =
		when === "current"
			? sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`
			: sql`${schema.personsToOrganisationalUnits.duration} << TSTZRANGE(NOW()::TIMESTAMPTZ, NULL)`;

	const rows = await db
		.select({
			personId: personEntityVersions.id,
			role: schema.personRoleTypes.type,
			name: schema.organisationalUnits.name,
			slug: schema.slugs.value,
			unitDocumentId: schema.entities.id,
			type: schema.organisationalUnitTypes.type,
			description: schema.personsToOrganisationalUnits.description,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			personEntityVersions,
			eq(personEntityVersions.entityId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personsToOrganisationalUnits.roleTypeId, schema.personRoleTypes.id),
		)
		.innerJoin(
			organisationalUnitDocumentLifecycle,
			eq(
				organisationalUnitDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, organisationalUnitDocumentLifecycle.publishedId),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, organisationalUnitDocumentLifecycle.documentId),
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnits.typeId, schema.organisationalUnitTypes.id),
		)
		.where(and(inArray(personEntityVersions.id, personIds), durationFilter));

	// Institutions and national consortia have no page of their own — they are surfaced on their
	// country's members-and-partners page — so their country is resolved in one extra query.
	const countrySlugs = await getCountrySlugsByOrganisationalUnitDocumentId(
		db,
		rows
			.filter((row) => row.type === "institution" || row.type === "national_consortium")
			.map((row) => row.unitDocumentId),
	);

	const rowsByPerson = new Map<string, Array<PersonPosition>>();

	for (const row of rows) {
		const items = rowsByPerson.get(row.personId) ?? [];
		items.push({
			role: row.role,
			description: row.description,
			duration: serializeDateRange(row.duration),
			entity: {
				id: row.unitDocumentId,
				type: row.type,
				slug: row.slug,
				label: row.name,
				href: getOrganisationalUnitHref(row.type, {
					slug: row.slug,
					countrySlug: countrySlugs.get(row.unitDocumentId),
				}),
			},
		});
		rowsByPerson.set(row.personId, items);
	}

	for (const personId of personIds) {
		const personRows = rowsByPerson.get(personId) ?? [];
		const sorted = personRows.toSorted(comparePositions);

		positions.set(personId, sorted.length > 0 ? sorted : null);
	}

	return positions;
}

//

export type PersonArticleType = "impact_case_study" | "spotlight_article";

export interface PersonArticle {
	type: PersonArticleType;
	id: string;
	title: string;
	summary: string;
	image: Image;
	entity: EntityRef;
	publishedAt: string;
	role: schema.ArticleContributorRole;
}

interface ArticleRow {
	id: string;
	title: string;
	summary: string;
	publicationDate: Date;
	entityId: string;
	slug: string;
	imageKey: string;
	imageAlt: string | null;
	imageCaption: JSONContent | null;
	imageWidth: number | null;
	imageHeight: number | null;
	/** The article's own caption choice for its featured image (see `withResolvedCaption`). */
	entityImageCaption: JSONContent | null;
	entityImageCaptionMode: ImageCaptionMode;
	licenseName: string | null;
	licenseUrl: string | null;
	role: schema.ArticleContributorRole;
}

/** The singular article kind maps to the plural CMS entity type of the article's own endpoint. */
const entityTypeByArticleType = {
	impact_case_study: "impact_case_studies",
	spotlight_article: "spotlight_articles",
} as const satisfies Record<PersonArticleType, PublicRelatedEntityType>;

function toArticle(type: PersonArticleType, row: ArticleRow): PersonArticle {
	const {
		entityId,
		imageKey,
		imageAlt,
		imageCaption,
		imageWidth: imageSourceWidth,
		imageHeight: imageSourceHeight,
		entityImageCaption,
		entityImageCaptionMode,
		licenseName,
		licenseUrl,
		publicationDate,
		slug,
		...rest
	} = row;

	const entityType = entityTypeByArticleType[type];

	return {
		type,
		...rest,
		image: generateImageUrl(
			withResolvedCaption(
				toImageAsset({
					key: imageKey,
					alt: imageAlt,
					caption: imageCaption,
					width: imageSourceWidth,
					height: imageSourceHeight,
					licenseName,
					licenseUrl,
				}),
				{ imageCaption: entityImageCaption, imageCaptionMode: entityImageCaptionMode },
			),
			imageWidth.preview,
		),
		entity: {
			id: entityId,
			type: entityType,
			slug,
			label: row.title,
			href: getWebsiteHref(entityType, { slug }),
		},
		publishedAt: publicationDate.toISOString(),
	};
}

/**
 * Articles a person is credited on, newest first. The contributor tables are document-level, so the
 * person version id is resolved to its document once, and each article document is resolved to its
 * published version — unpublished articles never surface.
 */
export async function getPersonArticles(
	db: Database | Transaction,
	personId: string,
): Promise<Array<PersonArticle>> {
	const personDocumentId = await resolveDocumentId(db, personId);

	const spotlightArticleDocumentLifecycle = alias(
		schema.documentLifecycle,
		"spotlight_article_document_lifecycle",
	);
	const impactCaseStudyDocumentLifecycle = alias(
		schema.documentLifecycle,
		"impact_case_study_document_lifecycle",
	);
	const spotlightArticleAssets = alias(schema.assets, "spotlight_article_assets");
	const impactCaseStudyAssets = alias(schema.assets, "impact_case_study_assets");
	const spotlightArticleLicenses = alias(schema.licenses, "spotlight_article_licenses");
	const impactCaseStudyLicenses = alias(schema.licenses, "impact_case_study_licenses");
	const spotlightArticleEntities = alias(schema.entities, "spotlight_article_entities");
	const impactCaseStudyEntities = alias(schema.entities, "impact_case_study_entities");
	const spotlightArticleSlugs = alias(schema.slugs, "spotlight_article_slugs");
	const impactCaseStudySlugs = alias(schema.slugs, "impact_case_study_slugs");

	const [spotlightArticles, impactCaseStudies] = await Promise.all([
		db
			.select({
				id: schema.spotlightArticles.id,
				title: schema.spotlightArticles.title,
				summary: schema.spotlightArticles.summary,
				publicationDate: schema.spotlightArticles.publicationDate,
				entityId: spotlightArticleEntities.id,
				slug: spotlightArticleSlugs.value,
				imageKey: spotlightArticleAssets.key,
				imageAlt: spotlightArticleAssets.alt,
				imageCaption: spotlightArticleAssets.caption,
				imageWidth: spotlightArticleAssets.width,
				imageHeight: spotlightArticleAssets.height,
				entityImageCaption: schema.spotlightArticles.imageCaption,
				entityImageCaptionMode: schema.spotlightArticles.imageCaptionMode,
				licenseName: spotlightArticleLicenses.name,
				licenseUrl: spotlightArticleLicenses.url,
				role: schema.spotlightArticlesToPersons.role,
			})
			.from(schema.spotlightArticlesToPersons)
			.innerJoin(
				spotlightArticleEntities,
				eq(
					spotlightArticleEntities.id,
					schema.spotlightArticlesToPersons.spotlightArticleDocumentId,
				),
			)
			.innerJoin(
				spotlightArticleDocumentLifecycle,
				eq(spotlightArticleDocumentLifecycle.documentId, spotlightArticleEntities.id),
			)
			.innerJoin(
				schema.spotlightArticles,
				eq(schema.spotlightArticles.id, spotlightArticleDocumentLifecycle.publishedId),
			)
			.innerJoin(
				spotlightArticleAssets,
				eq(spotlightArticleAssets.id, schema.spotlightArticles.imageId),
			)
			.leftJoin(
				spotlightArticleLicenses,
				eq(spotlightArticleLicenses.id, spotlightArticleAssets.licenseId),
			)
			.innerJoin(
				spotlightArticleSlugs,
				eq(spotlightArticleSlugs.entityVersionId, schema.spotlightArticles.id),
			)
			.where(eq(schema.spotlightArticlesToPersons.personDocumentId, personDocumentId)),
		db
			.select({
				id: schema.impactCaseStudies.id,
				title: schema.impactCaseStudies.title,
				summary: schema.impactCaseStudies.summary,
				publicationDate: schema.impactCaseStudies.publicationDate,
				entityId: impactCaseStudyEntities.id,
				slug: impactCaseStudySlugs.value,
				imageKey: impactCaseStudyAssets.key,
				imageAlt: impactCaseStudyAssets.alt,
				imageCaption: impactCaseStudyAssets.caption,
				imageWidth: impactCaseStudyAssets.width,
				imageHeight: impactCaseStudyAssets.height,
				entityImageCaption: schema.impactCaseStudies.imageCaption,
				entityImageCaptionMode: schema.impactCaseStudies.imageCaptionMode,
				licenseName: impactCaseStudyLicenses.name,
				licenseUrl: impactCaseStudyLicenses.url,
				role: schema.impactCaseStudiesToPersons.role,
			})
			.from(schema.impactCaseStudiesToPersons)
			.innerJoin(
				impactCaseStudyEntities,
				eq(impactCaseStudyEntities.id, schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId),
			)
			.innerJoin(
				impactCaseStudyDocumentLifecycle,
				eq(impactCaseStudyDocumentLifecycle.documentId, impactCaseStudyEntities.id),
			)
			.innerJoin(
				schema.impactCaseStudies,
				eq(schema.impactCaseStudies.id, impactCaseStudyDocumentLifecycle.publishedId),
			)
			.innerJoin(
				impactCaseStudyAssets,
				eq(impactCaseStudyAssets.id, schema.impactCaseStudies.imageId),
			)
			.leftJoin(
				impactCaseStudyLicenses,
				eq(impactCaseStudyLicenses.id, impactCaseStudyAssets.licenseId),
			)
			.innerJoin(
				impactCaseStudySlugs,
				eq(impactCaseStudySlugs.entityVersionId, schema.impactCaseStudies.id),
			)
			.where(eq(schema.impactCaseStudiesToPersons.personDocumentId, personDocumentId)),
	]);

	const articles = [
		...spotlightArticles.map((row) => toArticle("spotlight_article", row)),
		...impactCaseStudies.map((row) => toArticle("impact_case_study", row)),
	];

	return articles.toSorted((a, b) => {
		const byDate = b.publishedAt.localeCompare(a.publishedAt);
		if (byDate !== 0) {
			return byDate;
		}
		return a.title.localeCompare(b.title);
	});
}
