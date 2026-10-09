import { log } from "@acdh-oeaw/lib";
import type { CacheTag, RevalidationWebhookPayload } from "@dariah-eric/cache-tags";
import * as schema from "@dariah-eric/database/schema";
import { request } from "@dariah-eric/request";

import { env } from "@/config/env.config";
import { type Database, type Transaction, db } from "@/lib/db";
import { eq, inArray, or, sql } from "@/lib/db/sql";

/**
 * Mutations touching these tags change membership/working-group data, which placeholder-value nodes
 * embedded in other documents' richtext render. The api resolves those placeholders when serving
 * the embedding documents, so their tags must be dispatched too, even though their own content did
 * not change.
 */
const placeholderValueAffectingTags = new Set<CacheTag>(["members-partners", "working-groups"]);

const cacheTagsByEntityType: Partial<
	Record<(typeof schema.entityTypesEnum)[number], Array<CacheTag>>
> = {
	documents_policies: ["documents-policies"],
	events: ["events"],
	funding_calls: ["funding-calls"],
	impact_case_studies: ["impact-case-studies"],
	news: ["news"],
	opportunities: ["opportunities"],
	pages: ["pages"],
	persons: ["persons"],
	projects: ["projects"],
	spotlight_articles: ["spotlight-articles"],
	// Organisational units surface in the api as countries/institutions, governance bodies or working groups.
	organisational_units: ["governance-bodies", "members-partners", "working-groups"],
};

/** Tags of the published documents whose richtext embeds placeholder-value nodes. */
async function getPlaceholderValueEmbeddingTags(): Promise<Set<CacheTag>> {
	const marker = '%"placeholderValue"%';

	const rows = await db
		.selectDistinct({ type: schema.entityTypes.type })
		.from(schema.contentBlocks)
		.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
		)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.leftJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		// Every document that can hold a placeholder node is a `rich_text` block now, wherever in the
		// tree it sits: a callout's body and an accordion panel's body are blocks of that type too.
		.where(sql`${schema.richTextContentBlocks.content}::text LIKE ${marker}`);

	const tags = new Set<CacheTag>();
	for (const row of rows) {
		for (const tag of cacheTagsByEntityType[row.type] ?? []) {
			tags.add(tag);
		}
	}

	return tags;
}

/** Every column referencing an asset by id, on a table whose primary key is an entity version. */
const assetReferencingVersionColumns = [
	{
		table: schema.documentsPolicies,
		versionId: schema.documentsPolicies.id,
		assetId: schema.documentsPolicies.documentId,
	},
	{ table: schema.events, versionId: schema.events.id, assetId: schema.events.imageId },
	{
		table: schema.fundingCalls,
		versionId: schema.fundingCalls.id,
		assetId: schema.fundingCalls.imageId,
	},
	{
		table: schema.impactCaseStudies,
		versionId: schema.impactCaseStudies.id,
		assetId: schema.impactCaseStudies.imageId,
	},
	{ table: schema.news, versionId: schema.news.id, assetId: schema.news.imageId },
	{
		table: schema.opportunities,
		versionId: schema.opportunities.id,
		assetId: schema.opportunities.imageId,
	},
	{
		table: schema.organisationalUnits,
		versionId: schema.organisationalUnits.id,
		assetId: schema.organisationalUnits.imageId,
	},
	{ table: schema.pages, versionId: schema.pages.id, assetId: schema.pages.imageId },
	{ table: schema.persons, versionId: schema.persons.id, assetId: schema.persons.imageId },
	{ table: schema.projects, versionId: schema.projects.id, assetId: schema.projects.imageId },
	{
		table: schema.projectsToAssets,
		versionId: schema.projectsToAssets.projectId,
		assetId: schema.projectsToAssets.assetId,
	},
	{
		table: schema.spotlightArticles,
		versionId: schema.spotlightArticles.id,
		assetId: schema.spotlightArticles.imageId,
	},
];

/** Every column referencing an asset by id from a content block, keyed by that block's id. */
const assetReferencingBlockColumns = [
	{
		table: schema.galleryContentBlockItems,
		blockId: schema.galleryContentBlockItems.galleryContentBlockId,
		assetId: schema.galleryContentBlockItems.imageId,
	},
	{
		table: schema.heroContentBlocks,
		blockId: schema.heroContentBlocks.id,
		assetId: schema.heroContentBlocks.imageId,
	},
	{
		table: schema.imageContentBlocks,
		blockId: schema.imageContentBlocks.id,
		assetId: schema.imageContentBlocks.imageId,
	},
	{
		table: schema.mediaTextContentBlocks,
		blockId: schema.mediaTextContentBlocks.id,
		assetId: schema.mediaTextContentBlocks.imageId,
	},
];

/**
 * Every rich-text column on a content block, keyed by that block's id. An asset-targeted link
 * stores the asset's key, and the api attaches the asset's filename and size to it wherever it sits
 * in a document's blocks.
 */
const assetLinkingBlockColumns = [
	{
		table: schema.embedContentBlocks,
		blockId: schema.embedContentBlocks.id,
		content: schema.embedContentBlocks.caption,
	},
	{
		table: schema.galleryContentBlocks,
		blockId: schema.galleryContentBlocks.id,
		content: schema.galleryContentBlocks.caption,
	},
	{
		table: schema.galleryContentBlockItems,
		blockId: schema.galleryContentBlockItems.galleryContentBlockId,
		content: schema.galleryContentBlockItems.caption,
	},
	{
		table: schema.heroContentBlocks,
		blockId: schema.heroContentBlocks.id,
		content: schema.heroContentBlocks.caption,
	},
	{
		table: schema.heroContentBlocks,
		blockId: schema.heroContentBlocks.id,
		content: schema.heroContentBlocks.ctas,
	},
	{
		table: schema.imageContentBlocks,
		blockId: schema.imageContentBlocks.id,
		content: schema.imageContentBlocks.caption,
	},
	{
		table: schema.mediaTextContentBlocks,
		blockId: schema.mediaTextContentBlocks.id,
		content: schema.mediaTextContentBlocks.caption,
	},
	{
		table: schema.mediaTextContentBlocks,
		blockId: schema.mediaTextContentBlocks.id,
		content: schema.mediaTextContentBlocks.content,
	},
	{
		table: schema.richTextContentBlocks,
		blockId: schema.richTextContentBlocks.id,
		content: schema.richTextContentBlocks.content,
	},
];

/**
 * Tags of the api data that embeds the given assets, for changes to the assets themselves (their
 * metadata, or a merge re-pointing their references). Wherever the api serves an image it embeds
 * the asset's alt text, caption and license, and wherever it serves a link to one its filename and
 * size, so the tags are those of every entity type placing or linking one of the assets, plus site
 * metadata for its og image. Each operation embedding another type's images (a working group's
 * chairs, a person's articles, …) already declares that type's tag, so this does not need to follow
 * those relations. References from unpublished versions count too: that only ever purges more.
 *
 * Links are matched like the asset cleanup service matches them, by the key as a substring of the
 * rich text, which can only over-match.
 */
export async function getAssetCacheTags(
	db: Database | Transaction,
	assetIds: ReadonlyArray<string>,
): Promise<Array<CacheTag>> {
	if (assetIds.length === 0) {
		return [];
	}

	const ids = [...assetIds];

	const blockIdQueries = [
		...assetReferencingBlockColumns.map(({ table, blockId, assetId }) =>
			db.select({ id: blockId }).from(table).where(inArray(assetId, ids)),
		),
		...assetLinkingBlockColumns.map(({ table, blockId, content }) =>
			db
				.select({ id: blockId })
				.from(table)
				.where(
					sql`exists (select 1 from ${schema.assets} where ${inArray(schema.assets.id, ids)} and ${content}::text like '%' || ${schema.assets.key} || '%')`,
				),
		),
	];

	const versionIdQueries = [
		...assetReferencingVersionColumns.map(({ table, versionId, assetId }) =>
			db.select({ id: versionId }).from(table).where(inArray(assetId, ids)),
		),
		db
			.select({ id: schema.fields.entityVersionId })
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
			.where(or(...blockIdQueries.map((query) => inArray(schema.contentBlocks.id, query)))),
	];

	const rows = await db
		.selectDistinct({ type: schema.entityTypes.type })
		.from(schema.entityVersions)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.where(or(...versionIdQueries.map((query) => inArray(schema.entityVersions.id, query))));

	const siteMetadataRows = await db
		.select({ id: schema.siteMetadataTranslations.id })
		.from(schema.siteMetadataTranslations)
		.where(inArray(schema.siteMetadataTranslations.ogImageId, ids))
		.limit(1);

	// `assets` itself is only read by the download endpoint, which can name the file after its label.
	const tags = new Set<CacheTag>(["assets"]);
	for (const row of rows) {
		for (const tag of cacheTagsByEntityType[row.type] ?? []) {
			tags.add(tag);
		}
	}
	if (siteMetadataRows.length > 0) {
		tags.add("site-metadata");
	}

	return [...tags];
}

async function send(payload: RevalidationWebhookPayload): Promise<void> {
	if (env.REVALIDATION_WEBHOOK_URL == null || env.REVALIDATION_WEBHOOK_SECRET == null) {
		return;
	}

	log.info("[revalidation webhook] dispatching request", {
		tags: payload.tags,
		url: env.REVALIDATION_WEBHOOK_URL,
	});

	const result = await request(env.REVALIDATION_WEBHOOK_URL, {
		method: "post",
		headers: { Authorization: `Bearer ${env.REVALIDATION_WEBHOOK_SECRET}` },
		body: { tags: payload.tags },
		retry: { backoff: "exponential", delayMs: 200, times: 2 },
		responseType: "void",
	});

	if (result.isErr()) {
		log.error("[revalidation webhook] dispatch failed", result.error);
	}
}

/**
 * Notify the registered webhook that the data behind `tags` changed. The tags are the shared
 * `@dariah-eric/cache-tags` vocabulary: each names a slice of api data, and the api's openapi
 * document declares which operations read which slice, so the dashboard never needs to know which
 * website pages are affected.
 */
export async function dispatchWebhook(payload: { tags: Array<CacheTag> }): Promise<void> {
	if (env.REVALIDATION_WEBHOOK_URL == null || env.REVALIDATION_WEBHOOK_SECRET == null) {
		return;
	}

	const tags = new Set<CacheTag>(payload.tags);

	if (payload.tags.some((tag) => placeholderValueAffectingTags.has(tag))) {
		try {
			for (const tag of await getPlaceholderValueEmbeddingTags()) {
				tags.add(tag);
			}
		} catch (error) {
			log.error("[revalidation webhook] placeholder-value scan failed", error);
		}
	}

	await send({ tags: [...tags] });
}

/**
 * Dispatch the revalidation webhook for a raw entity-type token. A single entity type can surface
 * in the api under several tags (e.g. an organisational unit is both members-partners and
 * working-groups), so this maps to each of them. Callers can include tags for derived api data
 * whose dependency is narrower than every change to the entity type.
 */
export async function dispatchWebhookForEntityType(
	entityType: (typeof schema.entityTypesEnum)[number],
	additionalTags: Array<CacheTag> = [],
): Promise<void> {
	const tags = cacheTagsByEntityType[entityType];

	if (tags == null && additionalTags.length === 0) {
		return;
	}

	await dispatchWebhook({ tags: [...(tags ?? []), ...additionalTags] });
}

/**
 * Dispatch for every content type at once, for maintenance operations that rewrite content blocks
 * by id without reporting which documents they belonged to.
 */
export async function dispatchWebhookForAllContent(): Promise<void> {
	const tags = new Set<CacheTag>();
	for (const entityTags of Object.values(cacheTagsByEntityType)) {
		for (const tag of entityTags) {
			tags.add(tag);
		}
	}

	await dispatchWebhook({ tags: [...tags] });
}
