import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
	type AssetCandidate,
	type RichTextLinkCleanupContext,
	cleanRichTextLinksInDocument,
	getEntitySlugKey,
	groupAssetKeysByFilename,
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
		[getEntitySlugKey("projects", "esperanto-newspaper-excerpts"), new Set(["esperanto"])],
		[getEntitySlugKey("pages", "funding"), new Set(["funding"])],
		[
			getEntitySlugKey("pages", "funding-opportunities"),
			new Set(["opportunities-a", "opportunities-b"]),
		],
	]),
	assetKeysByFilename: new Map([
		["application form.docx", new Set(["documents/form"])],
		["flyer.pdf", new Set(["documents/flyer-a", "documents/flyer-b"])],
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
		for (const href of [
			"https://clariah.at/project-funding/",
			"https://clariah.at/de/project-funding",
			"https://clariah.at/en/project-funding/",
			"https://clariah.at/de/funding-opportunities-for-junior-researcher/",
		]) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "entity", entityId: "funding" },
				reason: "legacy_clariah_at_url",
			});
		}
	});

	it("repairs hrefs which were meant to be links to the old website", () => {
		for (const href of [
			"%5Bhttps://clariah.at/en/consortium/austrian-academy-of-sciences/%5D(https://clariah.at/en/consortium/austrian-academy-of-sciences/)",
			"[OeAW](https://clariah.at/en/consortium/austrian-academy-of-sciences)",
			"clariah.at/en/consortium/austrian-academy-of-sciences",
			"www.clariah.at/de/consortium/austrian-academy-of-sciences/",
			"consortium/austrian-academy-of-sciences/",
			"t/en/consortium/austrian-academy-of-sciences",
		]) {
			expect(resolveLegacyClariahAtHref(href, context), href).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "entity", entityId: "oeaw" },
				reason: "legacy_clariah_at_malformed_url",
			});
		}
		expect(resolveLegacyClariahAtHref("about-clariah-at", context)).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_entity_not_found",
		});
		expect(resolveLegacyClariahAtHref("t/fr/projects/some-project", context)).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_malformed_url_unmapped",
		});
	});

	it("ignores malformed hrefs which do not point at the old website", () => {
		for (const href of [
			"%5Bhttps://www.w3.org/TR/annotation-vocab/%5D(https://www.w3.org/TR/annotation-vocab/)",
			"example.org/some/path",
			"#section",
			"?page=2",
			"",
		]) {
			expect(resolveLegacyClariahAtHref(href, context), href).toStrictEqual({ action: "ignore" });
		}
	});

	it("maps root-level aliases of old items to entities", () => {
		for (const href of [
			"https://clariah.at/esperanto-newspaper-excerpts/",
			"https://clariah.at/en/esperanto-newspaper-excerpts",
		]) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "entity", entityId: "esperanto" },
				reason: "legacy_clariah_at_url",
			});
		}
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
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/some-wordpress-post/", context),
		).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_url_unmapped",
		});
		expect(resolveLegacyClariahAtHref("/de/unknown/path", context)).toStrictEqual({
			action: "review",
			reason: "legacy_clariah_at_relative_url_unmapped",
		});
	});

	it("rewrites files of the old website to the asset uploaded under their file name", () => {
		for (const href of [
			"https://clariah.at/assets/content/downloads/en/pages/x/application%20form.docx",
			"/de/assets/content/downloads/de/pages/x/application%20form.docx",
		]) {
			expect(resolveLegacyClariahAtHref(href, context)).toStrictEqual({
				action: "rewrite",
				replacement: { kind: "asset", assetKey: "documents/form" },
				reason: href.startsWith("/") ? "legacy_clariah_at_relative_url" : "legacy_clariah_at_url",
			});
		}
	});

	it("reports files of the old website without a single matching asset", () => {
		expect(
			resolveLegacyClariahAtHref(
				"https://clariah.at/assets/content/downloads/en/pages/x/file.docx",
				context,
			),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_asset_not_found" });
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/assets/content/downloads/flyer.pdf", context),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_asset_ambiguous" });
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/assets/content/downloads/flyer.pdf"),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_asset_unresolved" });
	});

	it("reports old items whose entity is missing or ambiguous", () => {
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/en/news/cfp-summerschool2025/", context),
		).toStrictEqual({ action: "review", reason: "legacy_clariah_at_entity_not_found" });
		expect(
			resolveLegacyClariahAtHref("https://clariah.at/funding-opportunities/", context),
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
		const content = doc(paragraphWithLink("https://clariah.at/some-wordpress-post/"));

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content).toStrictEqual(content);
		expect(result.reviews).toStrictEqual([
			{
				location: "$.content[0].content[0].marks[0].attrs.href",
				originalHref: "https://clariah.at/some-wordpress-post/",
				reason: "legacy_clariah_at_url_unmapped",
			},
		]);
	});

	it("rewrites link marks to asset links, clearing other target attributes", () => {
		const content = doc(
			paragraphWithLink(
				"https://clariah.at/assets/content/downloads/en/pages/x/application%20form.docx",
			),
		);

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.content?.[0]?.marks?.[0]).toStrictEqual({
			type: "link",
			attrs: {
				href: null,
				targetKind: "asset",
				assetKey: "documents/form",
				entityId: null,
				asset: null,
				entity: null,
			},
		});
		expect(result.reviews).toStrictEqual([]);
	});

	it("keeps the target of links which already have one, dropping an href to the old website", () => {
		const content = doc(
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						marks: [
							{
								type: "link",
								attrs: {
									href: "https://clariah.at/assets/content/downloads/en/news/x/flyer.pdf",
									targetKind: "asset",
									assetKey: "documents/flyer-a",
								},
							},
						],
						text: "Flyer",
					},
				],
			},
			{
				type: "buttonLink",
				attrs: {
					href: "https://clariah.at/en/consortium/austrian-academy-of-sciences/",
					targetKind: "entity",
					entityId: "oeaw",
				},
			},
		);

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content.content?.[0]?.content?.[0]?.marks?.[0]?.attrs).toStrictEqual({
			href: null,
			targetKind: "asset",
			assetKey: "documents/flyer-a",
		});
		expect(result.content.content?.[1]?.attrs).toStrictEqual({
			href: null,
			targetKind: "entity",
			entityId: "oeaw",
		});
		expect(result.rewrites.map((rewrite) => [rewrite.replacement, rewrite.reason])).toStrictEqual([
			[{ kind: "clear_href" }, "legacy_clariah_at_stale_href"],
			[{ kind: "clear_href" }, "legacy_clariah_at_stale_href"],
		]);
		expect(result.reviews).toStrictEqual([]);
	});

	it("leaves links which already have a target alone when their href is not the old website's", () => {
		const content = doc({
			type: "buttonLink",
			attrs: { href: "https://example.org/", targetKind: "entity", entityId: "oeaw" },
		});

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.content).toStrictEqual(content);
		expect(result.rewrites).toStrictEqual([]);
	});

	it("treats a target kind without its reference as a plain link", () => {
		const content = doc({
			type: "buttonLink",
			attrs: {
				href: "https://clariah.at/en/consortium/austrian-academy-of-sciences/",
				targetKind: "entity",
				entityId: null,
			},
		});

		const result = cleanRichTextLinksInDocument(content, context);

		expect(result.rewrites.map((rewrite) => rewrite.replacement)).toStrictEqual([
			{ kind: "entity", entityId: "oeaw" },
		]);
	});
});

describe("groupAssetKeysByFilename", () => {
	function asset(key: string, overrides: Partial<AssetCandidate> = {}): AssetCandidate {
		return {
			key,
			label: "form.docx",
			filename: null,
			mimeType: "application/msword",
			size: 100,
			contentHash: null,
			...overrides,
		};
	}

	it("collapses copies of one file to the oldest", () => {
		expect(
			groupAssetKeysByFilename([
				asset("documents/en"),
				asset("documents/de"),
				asset("documents/hashed", { contentHash: "abc" }),
			]),
		).toStrictEqual(new Map([["form.docx", new Set(["documents/en"])]]));
	});

	it("keeps a key per distinct file", () => {
		for (const other of [
			asset("documents/b", { size: 200 }),
			asset("documents/b", { size: null }),
			asset("documents/b", { mimeType: "application/pdf" }),
		]) {
			expect(groupAssetKeysByFilename([asset("documents/a"), other])).toStrictEqual(
				new Map([["form.docx", new Set(["documents/a", "documents/b"])]]),
			);
		}
		expect(
			groupAssetKeysByFilename([
				asset("documents/a", { contentHash: "abc" }),
				asset("documents/b", { contentHash: "def" }),
			]),
		).toStrictEqual(new Map([["form.docx", new Set(["documents/a", "documents/b"])]]));
	});

	it("matches the label and the file name", () => {
		expect(
			groupAssetKeysByFilename([asset("documents/a", { label: "Form", filename: "form.docx" })]),
		).toStrictEqual(
			new Map([
				["Form", new Set(["documents/a"])],
				["form.docx", new Set(["documents/a"])],
			]),
		);
	});
});
