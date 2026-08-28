import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { entityVersions } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";

export const opportunitySourcesEnum = ["dariah", "external"] as const;

export const opportunitySources = p.snakeCase.table(
	"opportunity_sources",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		source: p.text("source", { enum: opportunitySourcesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check("opportunity_sources_source_enum_check", inArray(t.source, opportunitySourcesEnum)),
	],
);

export type OpportunitySource = typeof opportunitySources.$inferSelect;
export type OpportunityProviderInput = typeof opportunitySources.$inferInsert;

export const OpportunitySourceSelectSchema = createSelectSchema(opportunitySources);
export const OpportunitySourceInsertSchema = createInsertSchema(opportunitySources);
export const OpportunitySourceUpdateSchema = createUpdateSchema(opportunitySources);

export const opportunities = p.snakeCase.table(
	"opportunities",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => entityVersions.id),
		title: p.text("title").notNull(),
		summary: p.text("summary").notNull(),
		duration: f.timestampRange("duration").notNull(),
		sourceId: p
			.uuid("source_id")
			.notNull()
			.references(() => opportunitySources.id),
		website: p.text("website"),
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
			"opportunities_image_caption_mode_enum_check",
			inArray(t.imageCaptionMode, imageCaptionModesEnum),
		),
	],
);

export type Opportunity = typeof opportunities.$inferSelect;
export type OpportunityInput = typeof opportunities.$inferInsert;

export const OpportunitySelectSchema = createSelectSchema(opportunities, {
	duration: f.TimestampRange,
});
export const OpportunityInsertSchema = createInsertSchema(opportunities, {
	duration: f.TimestampRange,
});
export const OpportunityUpdateSchema = createUpdateSchema(opportunities, {
	duration: f.TimestampRange,
});
