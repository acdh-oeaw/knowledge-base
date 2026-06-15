import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";

export const siteMetadata = p.snakeCase.table(
	"site_metadata",
	{
		id: p.integer("id").primaryKey().default(1),
		title: p.text("title").notNull(),
		description: p.text("description").notNull(),
		ogTitle: p.text("og_title"),
		ogDescription: p.text("og_description"),
		ogImageId: p.uuid("og_image_id").references(() => assets.id),
		featuredItemIds: p.jsonb("featured_item_ids"),
		...f.timestamps(),
	},
	(t) => [p.check("site_metadata_singleton", sql`${t.id} = 1`)],
);

export type SiteMetadata = typeof siteMetadata.$inferSelect;
export type SiteMetadataInput = typeof siteMetadata.$inferInsert;

export const SiteMetadataSelectSchema = createSelectSchema(siteMetadata);
export const SiteMetadataInsertSchema = createInsertSchema(siteMetadata);
export const SiteMetadataUpdateSchema = createUpdateSchema(siteMetadata);
