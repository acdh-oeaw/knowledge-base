import { log } from "@acdh-oeaw/lib";
import { request } from "@dariah-eric/request";

import { env } from "@/config/env.config";

export type WebhookEntityType =
	| "dariah-projects"
	| "documents-policies"
	| "events"
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

export async function dispatchWebhook(payload: { type: WebhookEntityType }): Promise<void> {
	if (env.REVALIDATION_WEBHOOK_URL == null || env.REVALIDATION_WEBHOOK_SECRET == null) {
		return;
	}

	log.info("[revalidation webhook] dispatching request", {
		type: payload.type,
		url: env.REVALIDATION_WEBHOOK_URL,
	});

	const result = await request(env.REVALIDATION_WEBHOOK_URL, {
		method: "post",
		headers: { Authorization: `Bearer ${env.REVALIDATION_WEBHOOK_SECRET}` },
		body: payload,
		retry: { backoff: "exponential", delayMs: 200, times: 2 },
		responseType: "void",
	});

	if (result.isErr()) {
		log.error("[revalidation webhook] dispatch failed", result.error);
	}
}
