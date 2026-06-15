import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import {
	ImageSchema,
	PaginatedResponseSchema,
	PaginationQuerySchema,
	RelatedEntitiesSchema,
	RelatedResourcesSchema,
} from "@/lib/schemas";

export const NewsItemBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.NewsItemSelectSchema, ["id", "title", "summary"]).entries,
		image: ImageSchema,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("News item"),
	v.metadata({ ref: "NewsItemBase" }),
);

export type NewsItemBase = v.InferOutput<typeof NewsItemBaseSchema>;

export const NewsItemListSchema = v.pipe(
	v.array(NewsItemBaseSchema),
	v.description("List of news"),
	v.metadata({ ref: "NewsItemList" }),
);

export type NewsItemList = v.InferOutput<typeof NewsItemListSchema>;

export const NewsItemSchema = v.pipe(
	v.object({
		...v.pick(schema.NewsItemSelectSchema, ["id", "title", "summary"]).entries,
		image: ImageSchema,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		content: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("News item"),
	v.metadata({ ref: "NewsItem" }),
);

export type NewsItem = v.InferOutput<typeof NewsItemSchema>;

export const NewsItemSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.NewsItemSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("News item slug"),
	v.metadata({ ref: "NewsItemSlug" }),
);

export type NewsItemSlug = v.InferOutput<typeof NewsItemSlugSchema>;

export const NewsItemSlugListSchema = v.pipe(
	v.array(NewsItemSlugSchema),
	v.description("List of news item slugs"),
	v.metadata({ ref: "NewsItemSlugList" }),
);

export type NewsItemSlugList = v.InferOutput<typeof NewsItemSlugListSchema>;

export const GetNews = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: NewsItemListSchema,
		}),
		v.description("Paginated list of news"),
		v.metadata({ ref: "GetNewsResponse" }),
	),
};

export const GetNewsItemById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get news item by id params"),
		v.metadata({ ref: "GetNewsItemByIdParams" }),
	),
	ResponseSchema: NewsItemSchema,
};

export const GetNewsItemSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: NewsItemSlugListSchema,
		}),
		v.description("Paginated list of news item slugs"),
		v.metadata({ ref: "GetNewsItemSlugsResponse" }),
	),
};

export const GetNewsItemBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get news item by slug params"),
		v.metadata({ ref: "GetNewsItemBySlugParams" }),
	),
	ResponseSchema: NewsItemSchema,
};
