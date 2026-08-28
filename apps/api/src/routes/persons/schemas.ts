import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import {
	EntityRefSchema,
	ImageSchema,
	LocaleQuerySchema,
	PaginatedResponseSchema,
	PaginationQuerySchema,
	PersonPositionsSchema,
} from "@/lib/schemas";

/**
 * A person's own social media entry, e.g. a personal website or a Bluesky profile. Distinct from
 * the social media of an organisational unit: those are shared outreach channels that reports track
 * KPIs for, while these belong to the person alone.
 */
export const PersonSocialMediaSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSocialMediaSelectSchema, ["url", "label"]).entries,
		type: v.picklist(schema.personSocialMediaTypesEnum),
	}),
	v.description("Social media account owned by a person"),
	v.metadata({ ref: "PersonSocialMedia" }),
);

export type PersonSocialMedia = v.InferOutput<typeof PersonSocialMediaSchema>;

export const PersonBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id", "name", "sortName", "email", "orcid"]).entries,
		positions: PersonPositionsSchema,
		image: v.nullable(ImageSchema),
		entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		socialMedia: v.array(PersonSocialMediaSchema),
	}),
	v.description("Person"),
	v.metadata({ ref: "PersonBase" }),
);

export type PersonBase = v.InferOutput<typeof PersonBaseSchema>;

export const PersonListSchema = v.pipe(
	v.array(PersonBaseSchema),
	v.description("List of persons"),
	v.metadata({ ref: "PersonList" }),
);

export type PersonList = v.InferOutput<typeof PersonListSchema>;

export const personArticleTypesEnum = ["impact_case_study", "spotlight_article"] as const;

/**
 * An article a person is credited on. Spotlight articles and impact case studies share a shape, so
 * they are returned as one chronological list discriminated by `type`.
 */
export const PersonArticleSchema = v.pipe(
	v.object({
		type: v.picklist(personArticleTypesEnum),
		...v.pick(schema.SpotlightArticleSelectSchema, ["id", "title", "summary"]).entries,
		image: ImageSchema,
		entity: EntityRefSchema,
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		role: v.picklist(schema.articleContributorRolesEnum),
	}),
	v.description("Article a person is credited on"),
	v.metadata({ ref: "PersonArticle" }),
);

export type PersonArticle = v.InferOutput<typeof PersonArticleSchema>;

export const PersonSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id", "name", "sortName", "email", "orcid"]).entries,
		positions: PersonPositionsSchema,
		/**
		 * Roles the person no longer holds, only ever returned on the person detail endpoints — every
		 * other endpoint embedding a person shows current positions alone.
		 */
		formerPositions: PersonPositionsSchema,
		image: v.nullable(ImageSchema),
		entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		socialMedia: v.array(PersonSocialMediaSchema),
		biography: v.optional(v.array(ContentBlockSchema), []),
		articles: v.array(PersonArticleSchema),
	}),
	v.description("Person"),
	v.metadata({ ref: "Person" }),
);

export type Person = v.InferOutput<typeof PersonSchema>;

export const PersonSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id"]).entries,
		entity: v.object({ slug: schema.SlugSelectSchema.entries.value }),
	}),
	v.description("Person slug"),
	v.metadata({ ref: "PersonSlug" }),
);

export type PersonSlug = v.InferOutput<typeof PersonSlugSchema>;

export const PersonSlugListSchema = v.pipe(
	v.array(PersonSlugSchema),
	v.description("List of person slugs"),
	v.metadata({ ref: "PersonSlugList" }),
);

export type PersonSlugList = v.InferOutput<typeof PersonSlugListSchema>;

export const GetPersons = {
	QuerySchema: v.object({ ...PaginationQuerySchema.entries, ...LocaleQuerySchema.entries }),
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: PersonListSchema,
		}),
		v.description("Paginated list of persons"),
		v.metadata({ ref: "GetPersonsResponse" }),
	),
};

export const GetPersonById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get person by id params"),
		v.metadata({ ref: "GetPersonByIdParams" }),
	),
	ResponseSchema: PersonSchema,
};

export const GetPersonSlugs = {
	QuerySchema: v.object({ ...PaginationQuerySchema.entries, ...LocaleQuerySchema.entries }),
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: PersonSlugListSchema,
		}),
		v.description("Paginated list of person slugs"),
		v.metadata({ ref: "GetPersonSlugsResponse" }),
	),
};

export const GetPersonBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get person by slug params"),
		v.metadata({ ref: "GetPersonBySlugParams" }),
	),
	QuerySchema: LocaleQuerySchema,
	ResponseSchema: PersonSchema,
};
