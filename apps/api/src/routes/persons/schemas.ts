import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import { ImageSchema, PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

export const PersonBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id", "name", "sortName", "email", "orcid"]).entries,
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
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
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

export const PersonSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id", "name", "sortName", "email", "orcid"]).entries,
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
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		biography: v.optional(v.array(ContentBlockSchema), []),
	}),
	v.description("Person"),
	v.metadata({ ref: "Person" }),
);

export type Person = v.InferOutput<typeof PersonSchema>;

export const PersonSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.PersonSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
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
	QuerySchema: PaginationQuerySchema,
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
	QuerySchema: PaginationQuerySchema,
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
	ResponseSchema: PersonSchema,
};
