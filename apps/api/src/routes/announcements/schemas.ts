import { ensureArray } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import {
	ImageSchema,
	PaginatedResponseSchema,
	PaginationQuerySchema,
	type publicRelatedEntityTypesEnum,
} from "@/lib/schemas";

export const announcementTypeValues = [
	"news",
	"opportunities",
	"funding_calls",
] as const satisfies ReadonlyArray<(typeof publicRelatedEntityTypesEnum)[number]>;

export type AnnouncementType = (typeof announcementTypeValues)[number];

/**
 * Fields every announcement carries, whatever its type, so a consumer can render an overview card
 * without narrowing first. `publishedAt` is the date the item is sorted and displayed by: a news
 * item's publication date, and the start of the duration for the two dated types.
 */
const announcementBaseEntries = {
	id: v.pipe(v.string(), v.uuid()),
	title: v.string(),
	summary: v.string(),
	image: ImageSchema,
	entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
	publishedAt: v.pipe(v.string(), v.isoTimestamp()),
};

const DurationSchema = v.object({
	start: v.pipe(v.string(), v.isoTimestamp()),
	end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const NewsAnnouncementSchema = v.pipe(
	v.object({
		...announcementBaseEntries,
		type: v.literal("news"),
	}),
	v.description("News item in the announcements feed"),
	v.metadata({ ref: "NewsAnnouncement" }),
);

export const OpportunityAnnouncementSchema = v.pipe(
	v.object({
		...announcementBaseEntries,
		type: v.literal("opportunities"),
		duration: DurationSchema,
		source: v.picklist(schema.opportunitySourcesEnum),
		website: v.nullable(v.string()),
	}),
	v.description("Opportunity in the announcements feed"),
	v.metadata({ ref: "OpportunityAnnouncement" }),
);

export const FundingCallAnnouncementSchema = v.pipe(
	v.object({
		...announcementBaseEntries,
		type: v.literal("funding_calls"),
		duration: DurationSchema,
	}),
	v.description("Funding call in the announcements feed"),
	v.metadata({ ref: "FundingCallAnnouncement" }),
);

export const AnnouncementSchema = v.pipe(
	v.variant("type", [
		NewsAnnouncementSchema,
		OpportunityAnnouncementSchema,
		FundingCallAnnouncementSchema,
	]),
	v.description("Announcement: a news item, opportunity or funding call"),
	v.metadata({ ref: "Announcement" }),
);

export type Announcement = v.InferOutput<typeof AnnouncementSchema>;

export const AnnouncementListSchema = v.pipe(
	v.array(AnnouncementSchema),
	v.description("List of announcements"),
	v.metadata({ ref: "AnnouncementList" }),
);

const AnnouncementTypeQuerySchema = v.pipe(
	v.unknown(),
	v.transform(ensureArray),
	v.array(v.picklist(announcementTypeValues)),
);

export const GetAnnouncements = {
	QuerySchema: v.object({
		...PaginationQuerySchema.entries,
		type: v.pipe(
			v.optional(AnnouncementTypeQuerySchema),
			v.description(
				"Filter by announcement type. Can be provided multiple times, e.g. `?type=news&type=opportunities`. Defaults to all types.",
			),
		),
	}),
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: AnnouncementListSchema,
		}),
		v.description("Paginated list of announcements"),
		v.metadata({ ref: "GetAnnouncementsResponse" }),
	),
};
