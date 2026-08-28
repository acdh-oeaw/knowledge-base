import {
	getEntityHref,
	getEntityListHref,
	interimPagePathBySlug,
	listableEntityTypes,
} from "@dariah-eric/website-routes";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
	cleanRichTextLinksInDocument,
	resolveLegacyDariahHref,
} from "./richtext-link-cleanup-service";

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

function paragraphWithLink(href: string): JSONContent {
	return {
		type: "paragraph",
		content: [
			{
				type: "text",
				marks: [{ type: "link", attrs: { href } }],
				text: "Read more",
			},
		],
	};
}

describe("resolveLegacyDariahHref", () => {
	it("rewrites old WordPress impact case study detail links to the new route", () => {
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/activities/impact-case-studies/sustainable-data/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/impact-case-studies/sustainable-data",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old WordPress spotlight and working group routes", () => {
		expect(resolveLegacyDariahHref("/activities/spotlight/example/")).toStrictEqual({
			action: "rewrite",
			href: "/spotlight/example",
			reason: "legacy_relative_url",
		});
		expect(resolveLegacyDariahHref("activities/working-groups/tools/")).toStrictEqual({
			action: "rewrite",
			href: "/network/working-groups/tools",
			reason: "legacy_relative_url",
		});
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/activities/working-groups/visual-media-and-interactivity/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "/network/working-groups/visual-media-and-interactivity",
			reason: "legacy_dariah_url",
		});
	});

	it("uses the interim page slug map for imported WordPress pages", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/about/dariah-in-nutshell/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/dariah-in-a-nutshell",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/about/dariah-in-a-nutshell.html"),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/dariah-in-a-nutshell",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old tools and services listing links to the resource catalogue", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/tools-services/tools-and-services/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/resources/resource-catalogue",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites known old tool detail links to external resources", () => {
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/tools-services/tools-and-services/tools/hypotheses-org-academic-blogs/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "https://hypotheses.org/",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old network partner-country links to members and partners", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/network/partners-countries/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/network/members-and-partners",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/network/partners-countries/czech-republic/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/network/members-and-partners/czech-republic",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old about partner-country detail links to members and partners", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/about/partners-countries/czech-republic/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/network/members-and-partners/czech-republic",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old organisation page links to organisation and governance", () => {
		expect(resolveLegacyDariahHref("http://www.dariah.eu/about/organisation.html")).toStrictEqual({
			action: "rewrite",
			href: "/about/organisation-and-governance",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/about/organisation/board-of-directors.html"),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/organisation-and-governance",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/about/organization-and-governance/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/organisation-and-governance",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old subscribe page links to newsletters", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/subscribe/")).toStrictEqual({
			action: "rewrite",
			href: "/newsletters",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old teach page links to the external teach site", () => {
		expect(resolveLegacyDariahHref("http://dariah.eu/teach/")).toStrictEqual({
			action: "rewrite",
			href: "https://teach.dariah.eu/",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old annual event page links to the external annual event site", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/news-events/annual-events/"),
		).toStrictEqual({
			action: "rewrite",
			href: "https://annualevent.dariah.eu/documents",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites deterministic redirects from the website redirect table", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/about/history-of-dariah/")).toStrictEqual(
			{
				action: "rewrite",
				href: "/about/dariah-in-a-nutshell",
				reason: "legacy_dariah_url",
			},
		);
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/activities/open-science/data-re-use/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/about/strategy",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/news-events/dariah-newsletters/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/newsletters",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old DARIAH Theme detail links to funding-call detail pages", () => {
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/activities/dariah-theme/dariah-theme-2018/"),
		).toStrictEqual({
			action: "rewrite",
			href: "/get-involved/funding-calls/dariah-theme-2018-sustainability",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/activities/dariah-theme/dariah-theme-2024-mistakes/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "/get-involved/funding-calls/dariah-theme-2024-mistakes",
			reason: "legacy_dariah_url",
		});
	});

	it("preserves search params and hashes", () => {
		expect(resolveLegacyDariahHref("/activities/projects/demo/?tab=about#team")).toStrictEqual({
			action: "rewrite",
			href: "/projects/demo?tab=about#team",
			reason: "legacy_relative_url",
		});
	});

	it("rewrites DB-backed old news, event, funding-call and project URL shapes when the slug exists", () => {
		const content = cleanRichTextLinksInDocument(
			doc(
				paragraphWithLink("https://www.dariah.eu/2020/12/10/example-news/"),
				paragraphWithLink("https://www.dariah.eu/event/example-event/"),
				paragraphWithLink(
					"https://www.dariah.eu/activities/dariah-theme/dariah-theme-2024-mistakes/",
				),
				paragraphWithLink("https://www.dariah.eu/activities/projects-and-affiliations/desir/"),
			),
			{
				eventSlugs: new Set(["example-event"]),
				fundingCallSlugs: new Set(["dariah-theme-2024-mistakes"]),
				newsSlugs: new Set(["example-news"]),
				projectSlugs: new Set(["desir"]),
			},
		);

		expect(content.content).toStrictEqual(
			doc(
				paragraphWithLink("/news/example-news"),
				paragraphWithLink("/events/example-event"),
				paragraphWithLink("/get-involved/funding-calls/dariah-theme-2024-mistakes"),
				paragraphWithLink("/projects/desir"),
			),
		);
	});

	it("keeps old DARIAH Theme URLs for review when the target funding-call slug is unknown", () => {
		const content = cleanRichTextLinksInDocument(
			doc(paragraphWithLink("https://www.dariah.eu/activities/dariah-theme/unknown-theme/")),
			{
				fundingCallSlugs: new Set(["dariah-theme-2018-sustainability"]),
			},
		);

		expect(content.rewrites).toHaveLength(0);
		expect(content.reviews).toStrictEqual([
			{
				location: "$.content[0].content[0].marks[0].attrs.href",
				originalHref: "https://www.dariah.eu/activities/dariah-theme/unknown-theme/",
				reason: "internal_dariah_url_unmapped",
			},
		]);
	});

	it("keeps old dated news URLs for review when the slug is unknown", () => {
		const content = cleanRichTextLinksInDocument(
			doc(paragraphWithLink("https://www.dariah.eu/2020/12/10/missing-news/")),
			{
				eventSlugs: new Set(["example-event"]),
				newsSlugs: new Set(["example-news"]),
				projectSlugs: new Set(["desir"]),
			},
		);

		expect(content.rewrites).toHaveLength(0);
		expect(content.reviews).toHaveLength(1);
	});

	it("rewrites old dated news URLs with known legacy slug changes", () => {
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/2018/06/27/dariah-eu-workshop-at-the-gi_forum-2018/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "/news/dariah-eu-workshop-at-the-gi-forum-2018",
			reason: "legacy_dariah_url",
		});
		expect(
			resolveLegacyDariahHref(
				"https://www.dariah.eu/2020/12/10/dariah-themecall-2020-2021-meet-the-winning-projects/",
			),
		).toStrictEqual({
			action: "rewrite",
			href: "/news/dariah-theme-call-2020-2021-meet-the-winning-projects",
			reason: "legacy_dariah_url",
		});
	});

	it("canonicalises absolute dariah.eu URLs that already use the new route", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/news/example/")).toStrictEqual({
			action: "rewrite",
			href: "/news/example",
			reason: "legacy_dariah_url",
		});
	});

	it("rewrites old WordPress training searches to the filtered news search", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/?s=training")).toStrictEqual({
			action: "rewrite",
			href: "/search?dariah-website[query]=trainingtuesday&dariah-website[menu][type]=news-item",
			reason: "legacy_dariah_search",
		});
		expect(resolveLegacyDariahHref("/?s=Training")).toStrictEqual({
			action: "rewrite",
			href: "/search?dariah-website[query]=trainingtuesday&dariah-website[menu][type]=news-item",
			reason: "legacy_relative_search",
		});
	});

	it("keeps other old WordPress search URLs for review", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/?s=events")).toStrictEqual({
			action: "review",
			reason: "internal_dariah_search_unmapped",
		});
	});

	it("ignores external, mail, anchor and upload links", () => {
		expect(resolveLegacyDariahHref("https://example.org/news")).toStrictEqual({
			action: "ignore",
		});
		expect(resolveLegacyDariahHref("mailto:info@dariah.eu")).toStrictEqual({ action: "ignore" });
		expect(resolveLegacyDariahHref("#section")).toStrictEqual({ action: "ignore" });
		expect(
			resolveLegacyDariahHref("https://www.dariah.eu/wp-content/uploads/2024/12/document.pdf"),
		).toStrictEqual({ action: "ignore" });
	});

	it("flags unresolved internal links for review", () => {
		expect(resolveLegacyDariahHref("https://www.dariah.eu/legacy/unknown/")).toStrictEqual({
			action: "review",
			reason: "internal_dariah_url_unmapped",
		});
		expect(resolveLegacyDariahHref("/legacy/unknown/")).toStrictEqual({
			action: "review",
			reason: "relative_url_unmapped",
		});
	});
});

describe("cleanRichTextLinksInDocument", () => {
	it("rewrites link marks and reports review-only internal links", () => {
		const input = doc(
			paragraphWithLink("https://www.dariah.eu/activities/spotlight/example/"),
			paragraphWithLink("https://www.dariah.eu/legacy/unknown/"),
		);

		const result = cleanRichTextLinksInDocument(input);

		expect(result.content).toStrictEqual(
			doc(
				paragraphWithLink("/spotlight/example"),
				paragraphWithLink("https://www.dariah.eu/legacy/unknown/"),
			),
		);
		expect(result.rewrites).toStrictEqual([
			{
				location: "$.content[0].content[0].marks[0].attrs.href",
				originalHref: "https://www.dariah.eu/activities/spotlight/example/",
				replacementHref: "/spotlight/example",
				reason: "legacy_dariah_url",
			},
		]);
		expect(result.reviews).toStrictEqual([
			{
				location: "$.content[1].content[0].marks[0].attrs.href",
				originalHref: "https://www.dariah.eu/legacy/unknown/",
				reason: "internal_dariah_url_unmapped",
			},
		]);
	});

	it("rewrites button link node hrefs", () => {
		const result = cleanRichTextLinksInDocument(
			doc({
				type: "buttonLink",
				attrs: { href: "/about/documents-list/", label: "Documents", variant: "primary" },
			}),
		);

		expect(result.content).toStrictEqual(
			doc({
				type: "buttonLink",
				attrs: { href: "/about/documents", label: "Documents", variant: "primary" },
			}),
		);
	});
});

/**
 * The cleanup service hardcodes website paths — `canonicalPathPrefixes` and the mapping targets —
 * that `@dariah-eric/website-routes` owns. A rename there (`/spotlights` → `/spotlight`) silently
 * turns rewrites into 404s and makes already-correct links look unmapped, so assert the two agree:
 * every path the mapper produces must survive a round trip unchanged.
 */
describe("canonical website paths stay in sync with @dariah-eric/website-routes", () => {
	const slug = "example-slug";

	const listingPaths = listableEntityTypes.map((type) => getEntityListHref(type));

	// Types with no detail page of their own (governance bodies, regional hubs, institutions,
	// documents, pages) are covered by their listing or resolve to a query string, so they are
	// deliberately absent here.
	const detailPaths = [
		getEntityHref({ type: "country", slug }),
		getEntityHref({ type: "event", slug }),
		getEntityHref({ type: "funding-call", slug }),
		getEntityHref({ type: "impact-case-study", slug }),
		getEntityHref({ type: "news-item", slug }),
		getEntityHref({ type: "opportunity", slug }),
		getEntityHref({ type: "person", slug }),
		getEntityHref({ type: "project", slug }),
		getEntityHref({ type: "spotlight-article", slug }),
		getEntityHref({ type: "working-group", slug }),
	];

	const canonicalPaths = [
		...new Set([...listingPaths, ...detailPaths, ...Object.values(interimPagePathBySlug)]),
	].toSorted();

	it.each(canonicalPaths)("keeps %s canonical", (pathname) => {
		expect(resolveLegacyDariahHref(`https://www.dariah.eu${pathname}/`)).toStrictEqual({
			action: "rewrite",
			href: pathname,
			reason: "legacy_dariah_url",
		});
	});
});
