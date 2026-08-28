import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";

/**
 * Vocabulary for {@link socialMedia}, the outbound outreach channels owned by organisational units,
 * projects and services — the ones reports track KPIs for.
 *
 * A person's own accounts use a separate vocabulary (`person_social_media_types`), so that
 * platforms only a researcher has (Google Scholar, ResearchGate) cannot be attached to an outreach
 * channel and vice versa. The two overlap heavily but neither contains the other, and keeping them
 * apart makes the rule a foreign key rather than a filter every picker has to remember.
 */
export const socialMediaTypesEnum = [
	"bluesky",
	"facebook",
	"flickr",
	"instagram",
	"linkedin",
	"mastodon",
	"twitter",
	"vimeo",
	"website",
	"youtube",
	"other",
] as const;

export const socialMediaTypes = p.snakeCase.table(
	"social_media_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: socialMediaTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("social_media_types_type_enum_check", inArray(t.type, socialMediaTypesEnum))],
);

export type SocialMediaType = typeof socialMediaTypes.$inferSelect;
export type SocialMediaTypeInput = typeof socialMediaTypes.$inferInsert;

export const SocialMediaTypeSelectSchema = createSelectSchema(socialMediaTypes);
export const SocialMediaTypeInsertSchema = createInsertSchema(socialMediaTypes);
export const SocialMediaTypeUpdateSchema = createUpdateSchema(socialMediaTypes);

export const socialMedia = p.snakeCase.table("social_media", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	name: p.text("name").notNull(),
	url: p.text("url").notNull(),
	duration: f.timestampRange("duration"),
	typeId: p
		.uuid("type_id")
		.notNull()
		.references(() => socialMediaTypes.id),
	...f.timestamps(),
});

export type SocialMedia = typeof socialMedia.$inferSelect;
export type SocialMediaInput = typeof socialMedia.$inferInsert;

export const SocialMediaSelectSchema = createSelectSchema(socialMedia, {
	duration: f.NullableTimestampRange,
});
export const SocialMediaInsertSchema = createInsertSchema(socialMedia, {
	duration: f.NullableTimestampRange,
});
export const SocialMediaUpdateSchema = createUpdateSchema(socialMedia, {
	duration: f.NullableTimestampRange,
});
