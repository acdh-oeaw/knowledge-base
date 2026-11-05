import { describe, expect, it } from "vitest";

import {
	getEntityListHref,
	interimPagePathBySlug,
	resolveInterimPagePath,
} from "./legacy-dariah-paths";

describe("resolveInterimPagePath", () => {
	it("maps known section-page slugs to their current website pathname (per issue #703)", () => {
		expect(resolveInterimPagePath("strategy")).toBe("/about/strategy");
		expect(resolveInterimPagePath("join-dariah")).toBe("/get-involved/join-dariah");
		expect(resolveInterimPagePath("regional-hubs")).toBe("/network/regional-hubs");
		// A slug that deliberately differs from the path leaf — the reason a hardcoded map is needed.
		expect(resolveInterimPagePath("transformations-a-dariah-journal")).toBe(
			"/resources/transformations",
		);
		// A nested pathname that cannot be derived from the single-segment slug.
		expect(resolveInterimPagePath("working-groups")).toBe("/network/working-groups");
		// Footer legal pages are CMS `page` entities.
		expect(resolveInterimPagePath("legal-notice")).toBe("/privacy-and-legal/legal-notice");
		expect(resolveInterimPagePath("partnerships-and-collaborations")).toBe(
			"/network/partnerships-and-collaborations",
		);
	});

	it("returns null for pages with no known route (callers must skip them)", () => {
		expect(resolveInterimPagePath("some-unrouted-page")).toBeNull();
		// The footer privacy-notice link no longer exists on the website.
		expect(resolveInterimPagePath("privacy-notice")).toBeNull();
	});

	it("every interim path is root-relative", () => {
		for (const path of Object.values(interimPagePathBySlug)) {
			expect(path).toMatch(/^\/[^/]/u);
		}
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
});
