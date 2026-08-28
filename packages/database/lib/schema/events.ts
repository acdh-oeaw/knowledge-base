import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";

export const events = p.snakeCase.table(
	"events",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		title: p.text("title").notNull(),
		summary: p.text("summary").notNull(),
		imageId: p
			.uuid("image_id")
			.notNull()
			.references(() => assets.id),
		location: p.text("location").notNull(),
		duration: f.timestampRange("duration").notNull(),
		isFullDay: p.boolean("is_full_day").notNull().default(false),
		website: p.text("website"),
		/**
		 * Caption for the featured image at this placement. `inherit` shows the asset's own caption,
		 * `override` shows {@link imageCaption}, `hidden` shows none - the same vocabulary image content
		 * blocks use (see `imageCaptionModesEnum`), so an image reads the same wherever it is placed.
		 */
		imageCaption: p.jsonb("image_caption").$type<JSONContent>(),
		imageCaptionMode: imageCaptionModeColumn("image_caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"events_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type Event = typeof events.$inferSelect;
export type EventInput = typeof events.$inferInsert;

export const EventSelectSchema = createSelectSchema(events, { duration: f.TimestampRange });
export const EventInsertSchema = createInsertSchema(events, { duration: f.TimestampRange });
export const EventUpdateSchema = createUpdateSchema(events, { duration: f.TimestampRange });
