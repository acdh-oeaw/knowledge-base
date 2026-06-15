import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ImageSchema, PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

const NationalConsortiumCountrySchema = v.object({
	...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "name"]).entries,
	slug: v.string(),
});

export const NationalConsortiumSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "name", "acronym"]).entries,
		slug: v.string(),
		country: v.nullable(NationalConsortiumCountrySchema),
		logo: v.nullable(ImageSchema),
	}),
	v.description("National consortium"),
	v.metadata({ ref: "NationalConsortium" }),
);

export type NationalConsortium = v.InferOutput<typeof NationalConsortiumSchema>;

export const NationalConsortiumListSchema = v.pipe(
	v.array(NationalConsortiumSchema),
	v.description("List of national consortia"),
	v.metadata({ ref: "NationalConsortiumList" }),
);

export type NationalConsortiumList = v.InferOutput<typeof NationalConsortiumListSchema>;

export const NationalConsortiumSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id"]).entries,
		slug: v.string(),
	}),
	v.description("National consortium slug"),
	v.metadata({ ref: "NationalConsortiumSlug" }),
);

export type NationalConsortiumSlug = v.InferOutput<typeof NationalConsortiumSlugSchema>;

export const NationalConsortiumSlugListSchema = v.pipe(
	v.array(NationalConsortiumSlugSchema),
	v.description("List of national consortium slugs"),
	v.metadata({ ref: "NationalConsortiumSlugList" }),
);

export type NationalConsortiumSlugList = v.InferOutput<typeof NationalConsortiumSlugListSchema>;

export const GetNationalConsortia = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: NationalConsortiumListSchema,
		}),
		v.description("Paginated list of national consortia"),
		v.metadata({ ref: "GetNationalConsortiaResponse" }),
	),
};

export const GetNationalConsortiumById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get national consortium by id params"),
		v.metadata({ ref: "GetNationalConsortiumByIdParams" }),
	),
	ResponseSchema: NationalConsortiumSchema,
};

export const GetNationalConsortiumSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: NationalConsortiumSlugListSchema,
		}),
		v.description("Paginated list of national consortium slugs"),
		v.metadata({ ref: "GetNationalConsortiumSlugsResponse" }),
	),
};

export const GetNationalConsortiumBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get national consortium by slug params"),
		v.metadata({ ref: "GetNationalConsortiumBySlugParams" }),
	),
	ResponseSchema: NationalConsortiumSchema,
};
