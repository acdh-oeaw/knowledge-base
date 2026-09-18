import { describe, expect, it } from "vitest";

import { cacheTags, isCacheTag, parseRevalidationWebhookPayload } from "./index";

describe("cacheTags", () => {
	it("is sorted and free of duplicates", () => {
		expect([...cacheTags]).toEqual([...new Set(cacheTags)].toSorted());
	});
});

describe("isCacheTag", () => {
	it("accepts every tag in the vocabulary", () => {
		for (const tag of cacheTags) {
			expect(isCacheTag(tag)).toBe(true);
		}
	});

	it("rejects strings outside the vocabulary and non-strings", () => {
		expect(isCacheTag("home")).toBe(false);
		expect(isCacheTag("")).toBe(false);
		expect(isCacheTag(null)).toBe(false);
		expect(isCacheTag(["news"])).toBe(false);
	});
});

describe("parseRevalidationWebhookPayload", () => {
	it("returns the de-duplicated tags of a valid payload", () => {
		expect(parseRevalidationWebhookPayload({ tags: ["news", "events", "news"] })).toEqual({
			tags: ["news", "events"],
		});
	});

	it("rejects payloads without tags, with empty tags, or with unknown tags", () => {
		expect(parseRevalidationWebhookPayload(null)).toBeNull();
		expect(parseRevalidationWebhookPayload({ type: "news" })).toBeNull();
		expect(parseRevalidationWebhookPayload({ tags: [] })).toBeNull();
		expect(parseRevalidationWebhookPayload({ tags: ["news", "home"] })).toBeNull();
		expect(parseRevalidationWebhookPayload({ tags: "news" })).toBeNull();
	});
});
