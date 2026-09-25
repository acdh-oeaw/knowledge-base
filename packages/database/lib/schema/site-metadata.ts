import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { locales } from "./locales";

/**
 * Shape of the `featured_item_ids` jsonb column: ordered entity-version ids featured on the public
 * landing page, grouped by landing-page section. The `news` section renders announcement items
 * (news, opportunities, funding calls). Each list is capped in the dashboard UI.
 */
export interface FeaturedItems {
	news: Array<string>;
	events: Array<string>;
	projects: Array<string>;
}

export const emptyFeaturedItems: FeaturedItems = { news: [], events: [], projects: [] };

export const siteMetadata = p.snakeCase.table(
	"site_metadata",
	{
		id: p.integer("id").primaryKey().default(1),
		featuredItemIds: p.jsonb("featured_item_ids").$type<FeaturedItems>(),
		...f.timestamps(),
	},
	(t) => [p.check("site_metadata_singleton", sql`${t.id} = 1`)],
);

export type SiteMetadata = typeof siteMetadata.$inferSelect;
export type SiteMetadataInput = typeof siteMetadata.$inferInsert;

export const SiteMetadataSelectSchema = createSelectSchema(siteMetadata);
export const SiteMetadataInsertSchema = createInsertSchema(siteMetadata);
export const SiteMetadataUpdateSchema = createUpdateSchema(siteMetadata);

export const siteMetadataTranslations = p.snakeCase.table("site_metadata_translations", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	localeId: p
		.uuid("locale_id")
		.notNull()
		.unique()
		.references(() => locales.id),
	title: p.text("title").notNull(),
	description: p.text("description").notNull(),
	ogTitle: p.text("og_title"),
	ogDescription: p.text("og_description"),
	ogImageId: p.uuid("og_image_id").references(() => assets.id),
	...f.timestamps(),
});

export type SiteMetadataTranslation = typeof siteMetadataTranslations.$inferSelect;
export type SiteMetadataTranslationInput = typeof siteMetadataTranslations.$inferInsert;

export const SiteMetadataTranslationSelectSchema = createSelectSchema(siteMetadataTranslations);
export const SiteMetadataTranslationInsertSchema = createInsertSchema(siteMetadataTranslations);
export const SiteMetadataTranslationUpdateSchema = createUpdateSchema(siteMetadataTranslations);
