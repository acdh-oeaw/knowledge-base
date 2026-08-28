import { log } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { request } from "@dariah-eric/request";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";

export type WebhookEntityType =
	| "dariah-projects"
	| "documents-policies"
	| "events"
	| "featured-entities"
	| "funding-calls"
	| "governance-bodies"
	| "impact-case-studies"
	| "members-partners"
	| "navigation"
	| "opportunities"
	| "news"
	| "pages"
	| "persons"
	| "site-metadata"
	| "spotlight-articles"
	| "working-groups";

/**
 * Mutations dispatching these types change membership/working-group data, which placeholder-value
 * nodes embedded in other pages' richtext render. Those pages must be revalidated too, even though
 * their own content did not change.
 */
const placeholderValueAffectingTypes = new Set<WebhookEntityType>([
	"members-partners",
	"working-groups",
]);

const webhookTypesByEntityType: Partial<
	Record<(typeof schema.entityTypesEnum)[number], Array<WebhookEntityType>>
> = {
	documents_policies: ["documents-policies"],
	events: ["events"],
	funding_calls: ["funding-calls"],
	impact_case_studies: ["impact-case-studies"],
	news: ["news"],
	opportunities: ["opportunities"],
	pages: ["pages"],
	persons: ["persons"],
	projects: ["dariah-projects"],
	spotlight_articles: ["spotlight-articles"],
	// Organisational units surface as countries or working groups on the website.
	organisational_units: ["members-partners", "working-groups"],
};

/** Website route groups whose published content embeds placeholder-value nodes. */
async function getPlaceholderValueEmbeddingWebhookTypes(): Promise<Set<WebhookEntityType>> {
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

	const types = new Set<WebhookEntityType>();
	for (const row of rows) {
		for (const type of webhookTypesByEntityType[row.type] ?? []) {
			types.add(type);
		}
	}

	return types;
}

async function send(type: WebhookEntityType): Promise<void> {
	if (env.REVALIDATION_WEBHOOK_URL == null || env.REVALIDATION_WEBHOOK_SECRET == null) {
		return;
	}

	log.info("[revalidation webhook] dispatching request", {
		type,
		url: env.REVALIDATION_WEBHOOK_URL,
	});

	const result = await request(env.REVALIDATION_WEBHOOK_URL, {
		method: "post",
		headers: { Authorization: `Bearer ${env.REVALIDATION_WEBHOOK_SECRET}` },
		body: { type },
		retry: { backoff: "exponential", delayMs: 200, times: 2 },
		responseType: "void",
	});

	if (result.isErr()) {
		log.error("[revalidation webhook] dispatch failed", result.error);
	}
}

export async function dispatchWebhook(payload: { type: WebhookEntityType }): Promise<void> {
	if (env.REVALIDATION_WEBHOOK_URL == null || env.REVALIDATION_WEBHOOK_SECRET == null) {
		return;
	}

	await send(payload.type);

	if (!placeholderValueAffectingTypes.has(payload.type)) {
		return;
	}

	try {
		const embeddingTypes = await getPlaceholderValueEmbeddingWebhookTypes();
		embeddingTypes.delete(payload.type);
		for (const type of embeddingTypes) {
			await send(type);
		}
	} catch (error) {
		log.error("[revalidation webhook] placeholder-value scan failed", error);
	}
}

/**
 * Dispatch the revalidation webhook(s) for a raw entity-type token. A single entity type can
 * surface on the website under several route groups (e.g. an organisational unit is both
 * members-partners and working-groups), so this fans out to each mapped {@link WebhookEntityType}.
 */
export async function dispatchWebhookForEntityType(
	entityType: (typeof schema.entityTypesEnum)[number],
): Promise<void> {
	for (const type of webhookTypesByEntityType[entityType] ?? []) {
		await dispatchWebhook({ type });
	}
}
