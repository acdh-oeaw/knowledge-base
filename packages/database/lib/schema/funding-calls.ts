import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";

export const fundingCalls = p.snakeCase.table(
	"funding_calls",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		title: p.text("title").notNull(),
		summary: p.text("summary").notNull(),
		duration: f.timestampRange("duration").notNull(),
		imageId: p
			.uuid("image_id")
			.notNull()
			.references(() => assets.id),
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
			"funding_calls_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type FundingCall = typeof fundingCalls.$inferSelect;
export type FundingCallInput = typeof fundingCalls.$inferInsert;

export const FundingCallSelectSchema = createSelectSchema(fundingCalls, {
	duration: f.TimestampRange,
});
export const FundingCallInsertSchema = createInsertSchema(fundingCalls, {
	duration: f.TimestampRange,
});
export const FundingCallUpdateSchema = createUpdateSchema(fundingCalls, {
	duration: f.TimestampRange,
});
