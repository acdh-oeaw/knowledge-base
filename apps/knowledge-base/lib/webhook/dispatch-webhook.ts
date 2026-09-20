import { log } from "@acdh-oeaw/lib";
import type { CacheTag, RevalidationWebhookPayload } from "@dariah-eric/cache-tags";
import * as schema from "@dariah-eric/database/schema";
import { request } from "@dariah-eric/request";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";

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
	// Organisational units surface in the api as countries/institutions or working groups.
	organisational_units: ["members-partners", "working-groups"],
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
