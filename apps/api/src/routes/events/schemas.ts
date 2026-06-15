import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import {
	CalendarDateSchema,
	ImageSchema,
	PaginatedResponseSchema,
	PaginationQuerySchema,
	RelatedEntitiesSchema,
	RelatedResourcesSchema,
} from "@/lib/schemas";

const eventBaseObject = v.object({
	...v.pick(schema.EventSelectSchema, ["id", "title", "summary", "location", "isFullDay"]).entries,
	image: ImageSchema,
	duration: v.object({
		start: CalendarDateSchema,
		end: v.optional(CalendarDateSchema),
	}),
	entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	publishedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const EventBaseSchema = v.pipe(
	eventBaseObject,
	v.description("Event"),
	v.metadata({ ref: "EventBase" }),
);

export type EventBase = v.InferOutput<typeof EventBaseSchema>;

export const EventListSchema = v.pipe(
	v.array(EventBaseSchema),
	v.description("List of events"),
	v.metadata({ ref: "EventList" }),
);

export type EventList = v.InferOutput<typeof EventListSchema>;

export const EventLinkSchema = v.pipe(
	v.pick(eventBaseObject, ["id", "title", "location", "isFullDay", "duration", "entity"]),
	v.description("Link to adjacent event"),
	v.metadata({ ref: "EventLink" }),
);

export type EventLink = v.InferOutput<typeof EventLinkSchema>;

export const EventSchema = v.pipe(
	v.object({
		...v.pick(schema.EventSelectSchema, ["id", "title", "summary", "location", "isFullDay"])
			.entries,
		website: v.nullable(v.string()),
		image: ImageSchema,
		duration: v.object({
			start: v.pipe(v.string(), v.isoTimestamp()),
			end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
		}),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		content: v.optional(v.array(ContentBlockSchema), []),
		links: v.object({
			prev: v.nullable(EventLinkSchema),
			next: v.nullable(EventLinkSchema),
		}),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("Event"),
	v.metadata({ ref: "Event" }),
);

export type Event = v.InferOutput<typeof EventSchema>;

export const EventSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.EventSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Event slug"),
	v.metadata({ ref: "EventSlug" }),
);

export type EventSlug = v.InferOutput<typeof EventSlugSchema>;

export const EventSlugListSchema = v.pipe(
	v.array(EventSlugSchema),
	v.description("List of event slugs"),
	v.metadata({ ref: "EventSlugList" }),
);

export type EventSlugList = v.InferOutput<typeof EventSlugListSchema>;

export const eventOrderValues = ["asc", "desc"] as const;

export type EventOrder = (typeof eventOrderValues)[number];

export const EventsQuerySchema = v.object({
	...PaginationQuerySchema.entries,
	from: v.pipe(
		v.optional(v.pipe(v.string(), v.isoDate())),
		v.description(
			"Return only events whose duration overlaps with or extends beyond this date (YYYY-MM-DD). Combined with `until`, defines a window: events starting before `until` and ending after `from`. Pass today's date to retrieve the first page of upcoming and ongoing events. Results are sorted ascending (soonest first) when this parameter is set.",
		),
		v.metadata({ ref: "EventFromParam" }),
	),
	until: v.pipe(
		v.optional(v.pipe(v.string(), v.isoDate())),
		v.description(
			"Return only events whose duration overlaps with or starts before this date (YYYY-MM-DD). Combined with `from`, defines a window: events starting before `until` and ending after `from`. When used without `from`, results are sorted descending (most recently started first).",
		),
		v.metadata({ ref: "EventUntilParam" }),
	),
});

export const GetEvents = {
	QuerySchema: EventsQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: EventListSchema,
		}),
		v.description("Paginated list of events"),
		v.metadata({ ref: "GetEventsResponse" }),
	),
};

export const GetEventById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get event by id params"),
		v.metadata({ ref: "GetEventByIdParams" }),
	),
	ResponseSchema: EventSchema,
};

export const GetEventSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: EventSlugListSchema,
		}),
		v.description("Paginated list of event slugs"),
		v.metadata({ ref: "GetEventSlugsResponse" }),
	),
};

export const GetEventBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get event by slug params"),
		v.metadata({ ref: "GetEventBySlugParams" }),
	),
	ResponseSchema: EventSchema,
};
