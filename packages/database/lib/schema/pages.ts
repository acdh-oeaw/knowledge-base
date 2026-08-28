import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";

export const pages = p.snakeCase.table(
	"pages",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		title: p.text("title").notNull(),
		summary: p.text("summary").notNull(),
		publicationDate: f.timestamp("publication_date").notNull(),
		imageId: p.uuid("image_id").references(() => assets.id),
		/**
		 * Caption for the featured image at this placement, resolved exactly as for image content
		 * blocks (see `imageCaptionModesEnum`): inherit the asset's caption, replace it here, or show
		 * none.
		 */
		imageCaption: p.jsonb("image_caption").$type<JSONContent>(),
		imageCaptionMode: imageCaptionModeColumn("image_caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"pages_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type Page = typeof pages.$inferSelect;
export type PageInput = typeof pages.$inferInsert;

export const PageSelectSchema = createSelectSchema(pages);
export const PageInsertSchema = createInsertSchema(pages);
export const PageUpdateSchema = createUpdateSchema(pages);
