import { describe, expect, it } from "vitest";

import { getEntityHref } from "./index";

describe("getEntityHref", () => {
	it("resolves each routable type to its website pathname", () => {
		expect(getEntityHref({ type: "event", slug: "e" })).toBe("/events/e");
		expect(getEntityHref({ type: "institution", slug: "i" })).toBe("/consortium/i");
		expect(getEntityHref({ type: "news-item", slug: "n" })).toBe("/news/n");
		expect(getEntityHref({ type: "page", slug: "funding" })).toBe("/pages/funding");
		expect(getEntityHref({ type: "project", slug: "p" })).toBe("/projects/p");
	});

	it("resolves pages backing a listing page to that listing page, in every locale", () => {
		expect(getEntityHref({ type: "page", slug: "projects" })).toBe("/projects");
		expect(getEntityHref({ type: "page", slug: "projekte" })).toBe("/projects");
		expect(getEntityHref({ type: "page", slug: "resources" })).toBe("/resources");
	});

	it("does not mistake a page slug for an inherited object key", () => {
		expect(getEntityHref({ type: "page", slug: "constructor" })).toBe("/pages/constructor");
	});

	it("returns locale-less, root-relative hrefs", () => {
		expect(getEntityHref({ type: "news-item", slug: "x" })).toMatch(/^\/[^/]/u);
	});
});
