import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ImageSchema, LocaleQuerySchema } from "@/lib/schemas";
import { AnnouncementSchema } from "@/routes/announcements/schemas";
import { ProjectSocialMediaSchema } from "@/routes/projects/schemas";

const FeaturedEventDateTimeSchema = v.pipe(v.string(), v.isoTimestamp());

const FeaturedEventSchema = v.pipe(
	v.object({
		type: v.literal("events"),
		...v.pick(schema.EventSelectSchema, ["id", "title", "summary", "location", "isFullDay"])
			.entries,
		image: ImageSchema,
		duration: v.object({
			start: FeaturedEventDateTimeSchema,
			end: v.optional(FeaturedEventDateTimeSchema),
		}),
		entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("Featured event"),
	v.metadata({ ref: "FeaturedEvent" }),
);

const FeaturedProjectSchema = v.pipe(
	v.object({
		type: v.literal("projects"),
		...v.pick(schema.ProjectSelectSchema, ["id", "name", "acronym", "summary", "topic", "funding"])
			.entries,
		image: v.nullable(ImageSchema),
		duration: v.object({
			start: v.pipe(v.string(), v.isoTimestamp()),
			end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
		}),
		entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
		scope: v.object({ scope: v.picklist(schema.projectScopesEnum) }),
		call: v.nullable(v.object({ call: v.picklist(schema.projectCallsEnum) })),
		socialMedia: v.array(ProjectSocialMediaSchema),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("Featured project"),
	v.metadata({ ref: "FeaturedProject" }),
);

export const FeaturedEntitiesSchema = v.pipe(
	v.object({
		news: v.array(AnnouncementSchema),
		events: v.array(FeaturedEventSchema),
		projects: v.array(FeaturedProjectSchema),
	}),
	v.description("Featured entities grouped by type"),
	v.metadata({ ref: "FeaturedEntities" }),
);

export type FeaturedEntities = v.InferOutput<typeof FeaturedEntitiesSchema>;

export const GetFeaturedEntities = {
	QuerySchema: LocaleQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			data: FeaturedEntitiesSchema,
		}),
		v.description("Featured entities"),
		v.metadata({ ref: "GetFeaturedEntitiesResponse" }),
	),
};
