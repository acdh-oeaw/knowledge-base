import { describe, expect, it } from "vitest";

import {
	getEntityHref,
	getEntityListHref,
	listableEntityTypes,
	routableEntityTypes,
	websiteEntityTypes,
} from "./index";

describe("getEntityHref", () => {
	it("resolves each routable type to its authoritative website pathname", () => {
		// Golden table — kept identical in the website repo (docs/website-url-resolution.md).
		expect(getEntityHref({ type: "news-item", slug: "hello" })).toBe("/news/hello");
		expect(getEntityHref({ type: "event", slug: "e" })).toBe("/events/e");
		expect(getEntityHref({ type: "person", slug: "jane-doe" })).toBe("/persons/jane-doe");
		expect(getEntityHref({ type: "project", slug: "p" })).toBe("/projects/p");
		expect(getEntityHref({ type: "spotlight-article", slug: "s" })).toBe("/spotlight/s");
		expect(getEntityHref({ type: "impact-case-study", slug: "i" })).toBe(
			"/about/impact-case-studies/i",
		);
		expect(getEntityHref({ type: "funding-call", slug: "fc" })).toBe(
			"/get-involved/funding-calls/fc",
		);
		expect(getEntityHref({ type: "opportunity", slug: "o" })).toBe("/get-involved/opportunities/o");
		expect(getEntityHref({ type: "working-group", slug: "wg" })).toBe("/network/working-groups/wg");
		expect(getEntityHref({ type: "country", slug: "at" })).toBe("/network/members-and-partners/at");
		expect(getEntityHref({ type: "governance-body", slug: "board-of-directors" })).toBe(
			"/about/organisation-and-governance?selectedBody=board-of-directors",
		);
		expect(getEntityHref({ type: "regional-hub" })).toBe("/network/regional-hubs");
		expect(getEntityHref({ type: "institution", countrySlug: "de" })).toBe(
			"/network/members-and-partners/de",
		);
		expect(getEntityHref({ type: "national-consortium", countrySlug: "fr" })).toBe(
			"/network/members-and-partners/fr",
		);
		expect(getEntityHref({ type: "document-or-policy" })).toBe("/about/documents");
		expect(getEntityHref({ type: "page", path: "/about/strategy" })).toBe("/about/strategy");
	});

	it("returns locale-less, root-relative hrefs", () => {
		expect(getEntityHref({ type: "news-item", slug: "x" })).toMatch(/^\/[^/]/u);
	});

	it("escapes slugs interpolated into a query string", () => {
		expect(getEntityHref({ type: "governance-body", slug: "a&b c" })).toBe(
			"/about/organisation-and-governance?selectedBody=a%26b%20c",
		);
	});
});

describe("getEntityListHref", () => {
	it("resolves each listable type to its collection pathname", () => {
		expect(getEntityListHref("news-item")).toBe("/news");
		expect(getEntityListHref("event")).toBe("/events");
		expect(getEntityListHref("project")).toBe("/projects");
		expect(getEntityListHref("spotlight-article")).toBe("/spotlight");
		expect(getEntityListHref("impact-case-study")).toBe("/about/impact-case-studies");
		expect(getEntityListHref("funding-call")).toBe("/get-involved/funding-calls");
		expect(getEntityListHref("opportunity")).toBe("/get-involved/opportunities");
		expect(getEntityListHref("working-group")).toBe("/network/working-groups");
		expect(getEntityListHref("country")).toBe("/network/members-and-partners");
		expect(getEntityListHref("document-or-policy")).toBe("/about/documents");
	});

	it("a listable type's detail page lives under its listing page", () => {
		// e.g. /get-involved/funding-calls/{slug} sits under /get-involved/funding-calls
		expect(getEntityHref({ type: "funding-call", slug: "x" })).toBe(
			`${getEntityListHref("funding-call")}/x`,
		);
		expect(getEntityHref({ type: "news-item", slug: "x" })).toBe(
			`${getEntityListHref("news-item")}/x`,
		);
	});
});

describe("entity type vocabularies", () => {
	it("routable types are a subset of the website vocabulary", () => {
		for (const type of routableEntityTypes) {
			expect(websiteEntityTypes).toContain(type);
		}
	});

	it("every listable type is a valid website type", () => {
		for (const type of listableEntityTypes) {
			expect(websiteEntityTypes).toContain(type);
		}
	});

	it("every website type is routable except the ERIC itself", () => {
		const notRoutable = websiteEntityTypes.filter(
			(type) => !(routableEntityTypes as ReadonlyArray<string>).includes(type),
		);
		expect(notRoutable).toStrictEqual(["eric"]);
	});
});
