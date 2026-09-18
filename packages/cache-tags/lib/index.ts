/**
 * Cache-tag vocabulary shared by the knowledge-base dashboard, the api and the website(s).
 *
 * A tag names a slice of the data the api serves, not a website page. The dashboard dispatches the
 * tags a mutation touched (see `@/lib/webhook/dispatch-webhook` in the knowledge-base app), every
 * api operation declares the tags it reads under `x-cache-tags` in the openapi document, and a
 * consumer tags its fetches with those and invalidates by whatever the webhook delivers. Because
 * tags describe api data rather than pages, every website consuming the api uses the same set.
 *
 * Pure and zero-dependency by design, so the module can be published and consumed by the website
 * repo unchanged.
 */

export const cacheTags = [
	"documents-policies",
	"events",
	"featured-entities",
	"funding-calls",
	"governance-bodies",
	"impact-case-studies",
	"members-partners",
	"navigation",
	"news",
	"opportunities",
	"pages",
	"persons",
	"projects",
	"site-metadata",
	"spotlight-articles",
	"working-groups",
] as const;

export type CacheTag = (typeof cacheTags)[number];

const cacheTagSet: ReadonlySet<string> = new Set(cacheTags);

export function isCacheTag(value: unknown): value is CacheTag {
	return typeof value === "string" && cacheTagSet.has(value);
}

/** Body of the `POST` the dashboard sends to a registered revalidation webhook url. */
export interface RevalidationWebhookPayload {
	tags: Array<CacheTag>;
}

/**
 * Parses an untrusted webhook body. Returns `null` when it is not a `{ tags }` object or any tag is
 * outside the vocabulary, so a consumer built against an older vocabulary fails loudly instead of
 * silently ignoring an unknown tag.
 */
export function parseRevalidationWebhookPayload(value: unknown): RevalidationWebhookPayload | null {
	if (typeof value !== "object" || value === null || !("tags" in value)) {
		return null;
	}

	const { tags } = value;

	if (!Array.isArray(tags) || tags.length === 0 || !tags.every((tag) => isCacheTag(tag))) {
		return null;
	}

	return { tags: [...new Set(tags)] };
}
