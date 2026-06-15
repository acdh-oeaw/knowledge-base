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

export const PageBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.PageSelectSchema, ["id", "title", "summary"]).entries,
		image: v.nullable(ImageSchema),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("Page"),
	v.metadata({ ref: "PageBase" }),
);

export type PageBase = v.InferOutput<typeof PageBaseSchema>;

export const PageListSchema = v.pipe(
	v.array(PageBaseSchema),
	v.description("List of pages"),
	v.metadata({ ref: "PageList" }),
);

export type PageList = v.InferOutput<typeof PageListSchema>;

export const PageSchema = v.pipe(
	v.object({
		...v.pick(schema.PageSelectSchema, ["id", "title", "summary"]).entries,
		image: v.nullable(ImageSchema),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		content: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("Page"),
	v.metadata({ ref: "Page" }),
);

export type Page = v.InferOutput<typeof PageSchema>;

export const PageSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.PageSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Page slug"),
	v.metadata({ ref: "PageSlug" }),
);

export type PageSlug = v.InferOutput<typeof PageSlugSchema>;

export const PageSlugListSchema = v.pipe(
	v.array(PageSlugSchema),
	v.description("List of page slugs"),
	v.metadata({ ref: "PageSlugList" }),
);

export type PageSlugList = v.InferOutput<typeof PageSlugListSchema>;

export const GetPages = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: PageListSchema,
		}),
		v.description("Paginated list of pages"),
		v.metadata({ ref: "GetPagesResponse" }),
	),
};

export const GetPageById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get page by id params"),
		v.metadata({ ref: "GetPageByIdParams" }),
	),
	ResponseSchema: PageSchema,
};

export const GetPageSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: PageSlugListSchema,
		}),
		v.description("Paginated list of page slugs"),
		v.metadata({ ref: "GetPageSlugsResponse" }),
	),
};

export const GetPageBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get page by slug params"),
		v.metadata({ ref: "GetPageBySlugParams" }),
	),
	ResponseSchema: PageSchema,
};
