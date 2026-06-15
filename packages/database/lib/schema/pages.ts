import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entityVersions } from "./entities";

export const pages = p.snakeCase.table("pages", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	summary: p.text("summary").notNull(),
	imageId: p.uuid("image_id").references(() => assets.id),
	...f.timestamps(),
});

export type Page = typeof pages.$inferSelect;
export type PageInput = typeof pages.$inferInsert;

export const PageSelectSchema = createSelectSchema(pages);
export const PageInsertSchema = createInsertSchema(pages);
export const PageUpdateSchema = createUpdateSchema(pages);
