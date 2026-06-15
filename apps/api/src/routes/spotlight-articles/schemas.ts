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

export const SpotlightArticleBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.SpotlightArticleSelectSchema, ["id", "title", "summary"]).entries,
		image: ImageSchema,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("Spotlight article"),
	v.metadata({ ref: "SpotlightArticleBase" }),
);

export type SpotlightArticleBase = v.InferOutput<typeof SpotlightArticleBaseSchema>;

export const SpotlightArticleListSchema = v.pipe(
	v.array(SpotlightArticleBaseSchema),
	v.description("List of spotlight articles"),
	v.metadata({ ref: "SpotlightArticleList" }),
);

export type SpotlightArticleList = v.InferOutput<typeof SpotlightArticleListSchema>;

export const SpotlightArticleSchema = v.pipe(
	v.object({
		...v.pick(schema.SpotlightArticleSelectSchema, ["id", "title", "summary"]).entries,
		image: ImageSchema,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		content: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		contributors: v.array(
			v.object({
				...v.pick(schema.PersonSelectSchema, ["id", "name"]).entries,
				position: v.nullable(
					v.array(
						v.object({
							role: v.picklist(schema.personRoleTypesEnum),
							name: v.string(),
							type: v.picklist(schema.organisationalUnitTypesEnum),
						}),
					),
				),
				image: v.nullable(ImageSchema),
				slug: v.string(),
				role: v.picklist(schema.articleContributorRolesEnum),
			}),
		),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("Spotlight article"),
	v.metadata({ ref: "SpotlightArticle" }),
);

export type SpotlightArticle = v.InferOutput<typeof SpotlightArticleSchema>;

export const SpotlightArticleSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.SpotlightArticleSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Spotlight article slug"),
	v.metadata({ ref: "SpotlightArticleSlug" }),
);

export type SpotlightArticleSlug = v.InferOutput<typeof SpotlightArticleSlugSchema>;

export const SpotlightArticleSlugListSchema = v.pipe(
	v.array(SpotlightArticleSlugSchema),
	v.description("List of spotlight article slugs"),
	v.metadata({ ref: "SpotlightArticleSlugList" }),
);

export type SpotlightArticleSlugList = v.InferOutput<typeof SpotlightArticleSlugListSchema>;

export const GetSpotlightArticles = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: SpotlightArticleListSchema,
		}),
		v.description("Paginated list of spotlight articles"),
		v.metadata({ ref: "GetSpotlightArticlesResponse" }),
	),
};

export const GetSpotlightArticleById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get spotlight article by id params"),
		v.metadata({ ref: "GetSpotlightArticleByIdParams" }),
	),
	ResponseSchema: SpotlightArticleSchema,
};

export const GetSpotlightArticleSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: SpotlightArticleSlugListSchema,
		}),
		v.description("Paginated list of spotlight article slugs"),
		v.metadata({ ref: "GetSpotlightArticleSlugsResponse" }),
	),
};

export const GetSpotlightArticleBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get spotlight article by slug params"),
		v.metadata({ ref: "GetSpotlightArticleBySlugParams" }),
	),
	ResponseSchema: SpotlightArticleSchema,
};
