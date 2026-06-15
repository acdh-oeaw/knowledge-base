import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entityVersions } from "./entities";

export const externalLinks = p.snakeCase.table("external_links", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	summary: p.text("summary").notNull(),
	url: p.text("url").notNull(),
	imageId: p
		.uuid("image_id")
		.notNull()
		.references(() => assets.id),
	...f.timestamps(),
});

export type ExternalLink = typeof externalLinks.$inferSelect;
export type ExternalLinkInput = typeof externalLinks.$inferInsert;

export const ExternalLinkSelectSchema = createSelectSchema(externalLinks);
export const ExternalLinkInsertSchema = createInsertSchema(externalLinks);
export const ExternalLinkUpdateSchema = createUpdateSchema(externalLinks);
