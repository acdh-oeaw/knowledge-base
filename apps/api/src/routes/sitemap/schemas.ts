import * as v from "valibot";

import type { PublicRelatedEntityType } from "@/lib/schemas";

/**
 * The entity types a sitemap url can be derived from — a subset of the public entity vocabulary,
 * because not every published document adds a url of its own:
 *
 * - `eric` has no page at all.
 * - `institution` and `national_consortium` live on their country's page, which `country` already
 *   contributes.
 * - `regional_hub` and `governance_body` are surfaced within a single CMS page
 *   (`/network/regional-hubs` and `/about/organisation-and-governance`), which `pages` already
 *   contributes; governance bodies are selected there via a query param, and query-string variants
 *   of one page are not distinct documents.
 * - `documentation_pages` and `internal_pages` are not public at all.
 */
export const sitemapEntityTypesEnum = [
	"country",
	"documents_policies",
	"events",
	"funding_calls",
	"impact_case_studies",
	"news",
	"opportunities",
	"pages",
	"persons",
	"projects",
	"spotlight_articles",
	"working_group",
] as const satisfies ReadonlyArray<PublicRelatedEntityType>;

export type SitemapEntityType = (typeof sitemapEntityTypesEnum)[number];

export const SitemapEntrySchema = v.pipe(
	v.object({
		href: v.pipe(
			v.string(),
			v.description(
				"Root-relative, locale-less website href. Prepend locale and origin, as for entity hrefs.",
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
					"Published documents skipped because no website url could be resolved for them. Currently only pages missing from the interim slug→path map; a non-zero value means the sitemap is incomplete.",
				),
			),
		}),
		v.description("All website urls derived from published content"),
		v.metadata({ ref: "GetSitemapResponse" }),
	),
};
