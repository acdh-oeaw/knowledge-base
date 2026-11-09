import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
	type RichTextLinkCleanupContext,
	cleanRichTextLinksInDocument,
	getEntitySlugKey,
	resolveLegacyClariahAtHref,
} from "./richtext-link-cleanup-service";

const context: RichTextLinkCleanupContext = {
	entityIdsBySlug: new Map([
		[getEntitySlugKey("organisational_units", "austrian-academy-of-sciences"), new Set(["oeaw"])],
		[
			getEntitySlugKey("organisational_units", "oesterreichische-akademie-der-wissenschaften"),
			new Set(["oeaw"]),
		],
		[
			getEntitySlugKey("projects", "summer-school-machine-learning-for-digital-scholarly-editions"),
			new Set(["summer-school"]),
		],
		[getEntitySlugKey("pages", "zu-ehren-thierry-declerck"), new Set(["declerck"])],
		[getEntitySlugKey("pages", "funding"), new Set(["funding"])],
		[getEntitySlugKey("pages", "project-funding"), new Set(["funding-a", "funding-b"])],
	]),
};

function doc(...content: Array<JSONContent>): JSONContent {
	return { type: "doc", content };
}

function paragraphWithLink(href: string): JSONContent {
	return {
		type: "paragraph",
		content: [{ type: "text", marks: [{ type: "link", attrs: { href } }], text: "Read more" }],
	};
}

describe("resolveLegacyClariahAtHref", () => {
	it("rewrites links to old detail pages to entity links, whatever the old locale", () => {
		for (const href of [
			"https://clariah.at/en/consortium/austrian-academy-of-sciences/",
			"https://www.clariah.at/de/consortium/austrian-academy-of-sciences",
			"http://clariah.at/en/consortium/austrian-academy-of-sciences",
		]) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "entity", entityId: "oeaw" },
				reason: "legacy_clariah_at_url",
			});
		}
	});

	it("maps old ids, which are not the imported slugs, to entities", () => {
		expect(
			resolveLegacyClariahAtHref(
				"https://clariah.at/de/projects/summer-school-ml-for-digital-editions/",
				context,
			),
		).toStrictEqual({
			action: "rewrite",
			replacement: { kind: "entity", entityId: "summer-school" },
			reason: "legacy_clariah_at_url",
		});
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/in-honor-of-thierry-declerck/", context),
		).toStrictEqual({
			action: "rewrite",
			replacement: { kind: "entity", entityId: "declerck" },
			reason: "legacy_clariah_at_url",
		});
	});

	it("rewrites root-relative links with an old locale prefix", () => {
		expect(
			resolveLegacyClariahAtHref("/en/consortium/austrian-academy-of-sciences", context),
		).toStrictEqual({
			action: "rewrite",
			replacement: { kind: "entity", entityId: "oeaw" },
			reason: "legacy_clariah_at_relative_url",
		});
	});

	it("rewrites current website paths pinned to a locale by their current slug", () => {
		for (const href of ["/en/pages/funding", "https://clariah.at/de/pages/funding"]) {
			expect(resolveLegacyClariahAtHref(href, context)).toMatchObject({
				action: "rewrite",
				replacement: { kind: "entity", entityId: "funding" },
			});
		}
	});

	it("tolerates a doubled locale prefix", () => {
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/en/in-honor-of-thierry-declerck/", context),
		).toMatchObject({ action: "rewrite", replacement: { kind: "entity", entityId: "declerck" } });
	});

	it("rewrites the home page, listings and imprint to locale-less paths", () => {
		const cases: Array<[string, string]> = [
			["https://clariah.at/", "/"],
			["https://clariah.at/en", "/"],
			["https://clariah.at/de/", "/"],
			["https://clariah.at/de/news/", "/news"],
			["https://clariah.at/en/events", "/events"],
			["https://clariah.at/en/projects/", "/projects"],
			["https://clariah.at/de/imprint", "/imprint"],
		];
		for (const [href, expected] of cases) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "href", href: expected },
				reason: "legacy_clariah_at_url",
			});
		}
	});

	it("drops tracking parameters", () => {
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/news?ref=info.kulturpool.at", context),
		).toStrictEqual({
			action: "rewrite",
			replacement: { kind: "href", href: "/news" },
			reason: "legacy_clariah_at_url",
		});
	});

	it("reports entity targets which an entity link cannot express", () => {
		expect(
			resolveLegacyClariahAtHref(
				"https://clariah.at/en/consortium/austrian-academy-of-sciences#people",
				context,
			),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_entity_with_query_or_hash" });
	});

	it("reports paths the old website did not have, e.g. from its WordPress predecessor", () => {
		expect(resolveLegacyClariahAtHref("https://clariah.at/ladderweb/", context)).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_url_unmapped",
		});
		expect(resolveLegacyClariahAtHref("/de/unknown/path", context)).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_relative_url_unmapped",
		});
	});

	it("reports files of the old website", () => {
		expect(
			resolveLegacyClariahAtHref(
				"https://clariah.at/assets/content/downloads/en/pages/x/file.docx",
				context,
			),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_asset" });
	});

	it("reports old items whose entity is missing or ambiguous", () => {
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/news/cfp-summerschool2025/", context),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_entity_not_found" });
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/project-funding/", context),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_entity_ambiguous" });
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/consortium/austrian-academy-of-sciences"),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_entity_unresolved" });
	});

	it("ignores current website paths and other links", () => {
		for (const href of [
			"/news/some-news-item",
			"/consortium/austrian-academy-of-sciences",
			"https://clarin.eu/en/news",
			"https://sub.clariah.at/en/news",
			"mailto:info@clariah.at",
			"#section",
		]) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({ action: "ignore" });
		}
	});
});

describe("cleanRichTextLinksInDocument", () => {
	it("rewrites link marks to entity links, clearing other target attributes", () => {
		const content = doc(
			paragraphWithLink("https://clariah.at/en/consortium/austrian-academy-of-sciences/"),
		);

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.content?.[0]?.marks?.[0]).toStrictEqual({
			type: "link",
			attrs: {
				href: null,
				targetKind: "entity",
				assetKey: null,
				entityId: "oeaw",
				asset: null,
				entity: null,
			},
		});
		expect(result.rewrites).toStrictEqual([
			{
				location: "$.content[0].content[0].marks[0].attrs.href",
				originalHref: "https://clariah.at/en/consortium/austrian-academy-of-sciences/",
				replacement: { kind: "entity", entityId: "oeaw" },
				reason: "legacy_clariah_at_url",
			},
		]);
		expect(result.reviews).toStrictEqual([]);
		// The input document is not mutated.
		expect(content.content?.[0]?.content?.[0]?.marks?.[0]?.attrs?.href).toBe(
			"https://clariah.at/en/consortium/austrian-academy-of-sciences/",
		);
	});

	it("rewrites link marks to paths, keeping their other attributes", () => {
		const content = doc({
			type: "paragraph",
			content: [
				{
					type: "text",
					marks: [
						{ type: "link", attrs: { href: "https://clariah.at/de/news/", target: "_blank" } },
					],
					text: "News",
				},
			],
		});

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.content?.[0]?.marks?.[0]?.attrs).toStrictEqual({
			href: "/news",
			target: "_blank",
		});
	});

	it("rewrites button links to paths", () => {
		const content = doc({
			type: "buttonLink",
			attrs: { href: "https://clariah.at/en/news", label: "News", variant: "primary" },
		});

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.attrs).toStrictEqual({
			href: "/news",
			label: "News",
			variant: "primary",
		});
		expect(result.rewrites).toStrictEqual([
			{
				location: "$.content[0].attrs.href",
				originalHref: "https://clariah.at/en/news",
				replacement: { kind: "href", href: "/news" },
				reason: "legacy_clariah_at_url",
			},
		]);
	});

	it("rewrites button links to entity links", () => {
		const content = doc({
			type: "buttonLink",
			attrs: {
				href: "https://clariah.at/en/consortium/austrian-academy-of-sciences/",
				label: "ÖAW",
				variant: "primary",
			},
		});

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.attrs).toStrictEqual({
			href: null,
			label: "ÖAW",
			variant: "primary",
			targetKind: "entity",
			assetKey: null,
			entityId: "oeaw",
			asset: null,
			entity: null,
		});
		expect(result.reviews).toStrictEqual([]);
	});

	it("reports links which cannot be rewritten, and leaves them alone", () => {
		const content = doc(paragraphWithLink("https://clariah.at/ladderweb/"));

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content).toStrictEqual(content);
		expect(result.reviews).toStrictEqual([
			{
				location: "$.content[0].content[0].marks[0].attrs.href",
				originalHref: "https://clariah.at/ladderweb/",
				reason: "legacy_clariah_at_url_unmapped",
			},
		]);
	});
});
