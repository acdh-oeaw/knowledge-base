import * as v from "valibot";

import type { PublicRelatedEntityType } from "@/lib/schemas";

/**
 * The entity types with a page on the website, which is a subset of the public entity vocabulary.
 * `institution` is further limited to the members of the national consortium.
 */
export const sitemapEntityTypesEnum = [
	"events",
	"institution",
	"news",
	"pages",
	"projects",
] as const satisfies ReadonlyArray<PublicRelatedEntityType>;

export type SitemapEntityType = (typeof sitemapEntityTypesEnum)[number];

export const SitemapEntrySchema = v.pipe(
	v.object({
		href: v.pipe(
			v.string(),
			v.description(
				"Root-relative website href, with its locale segment already prepended (e.g. `/en/...`, `/de/...`). Prepend only the origin.",
			),
		),
		locale: v.pipe(
			v.string(),
			v.description(
				'BCP 47-style locale code (e.g. "de" or "de-AT"), matching the `?locale=` query param this api accepts elsewhere and the locale segment already present in `href`',
			),
		),
		type: v.pipe(
			v.picklist(sitemapEntityTypesEnum),
			v.description("Entity type this url was derived from"),
		),
		lastModified: v.pipe(
			v.string(),
			v.isoTimestamp(),
			v.description(
				"Most recent publish timestamp among the documents behind this url (`publishedAt` elsewhere in this api). Maps to sitemap `lastmod`.",
			),
		),
		alternates: v.pipe(
			v.array(
				v.object({
					locale: v.pipe(
						v.string(),
						v.description('BCP 47-style locale code (e.g. "de" or "de-AT")'),
					),
					href: v.pipe(
						v.string(),
						v.description(
							"Root-relative website href in that locale, with its locale segment already prepended. Prepend only the origin.",
						),
					),
				}),
			),
			v.description(
				'This url in every locale it is published in, including this entry\'s own locale, sorted by locale. Maps to sitemap `<xhtml:link rel="alternate" hreflang>`; `x-default` is left to the consumer.',
			),
		),
	}),
	v.description("Sitemap entry"),
	v.metadata({ ref: "SitemapEntry" }),
);

export type SitemapEntry = v.InferOutput<typeof SitemapEntrySchema>;

export const SitemapEntryListSchema = v.pipe(
	v.array(SitemapEntrySchema),
	v.description("List of sitemap entries"),
	v.metadata({ ref: "SitemapEntryList" }),
);

export type SitemapEntryList = v.InferOutput<typeof SitemapEntryListSchema>;

export const GetSitemap = {
	ResponseSchema: v.pipe(
		v.object({
			data: SitemapEntryListSchema,
			total: v.pipe(v.number(), v.description("Number of urls")),
			unresolved: v.pipe(
				v.number(),
				v.description(
					"Published documents skipped because no website url could be resolved for them.",
				),
			),
		}),
		v.description("All website urls derived from published content"),
		v.metadata({ ref: "GetSitemapResponse" }),
	),
};
