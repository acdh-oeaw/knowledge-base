import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ImageSchema, PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

/**
 * The two organisational-unit relation statuses an institution can hold towards the DARIAH-EU ERIC,
 * as short, consumer-facing values (the `is_`/`_of` grammar only makes sense database-side).
 */
export const institutionRelationStatusEnum = [
	"partner_institution",
	"cooperating_partner",
] as const;

export type InstitutionRelationStatus = (typeof institutionRelationStatusEnum)[number];

/**
 * An institution's status towards the DARIAH-EU ERIC. `none` means the institution holds no active
 * partner-institution or cooperating-partner relation to DARIAH-EU, so every institution maps to
 * exactly one value.
 */
export const institutionStatusEnum = [...institutionRelationStatusEnum, "none"] as const;

export type InstitutionStatus = (typeof institutionStatusEnum)[number];

const InstitutionCountrySchema = v.object({
	...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "name"]).entries,
	slug: v.string(),
});

export const InstitutionSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "name", "acronym", "ror"]).entries,
		slug: v.string(),
		status: v.picklist(institutionStatusEnum),
		country: v.nullable(InstitutionCountrySchema),
		logo: v.nullable(ImageSchema),
	}),
	v.description("Institution"),
	v.metadata({ ref: "Institution" }),
);

export type Institution = v.InferOutput<typeof InstitutionSchema>;

export const InstitutionListSchema = v.pipe(
	v.array(InstitutionSchema),
	v.description("List of institutions"),
	v.metadata({ ref: "InstitutionList" }),
);

export type InstitutionList = v.InferOutput<typeof InstitutionListSchema>;

export const InstitutionSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id"]).entries,
		slug: v.string(),
	}),
	v.description("Institution slug"),
	v.metadata({ ref: "InstitutionSlug" }),
);

export type InstitutionSlug = v.InferOutput<typeof InstitutionSlugSchema>;

export const InstitutionSlugListSchema = v.pipe(
	v.array(InstitutionSlugSchema),
	v.description("List of institution slugs"),
	v.metadata({ ref: "InstitutionSlugList" }),
);

export type InstitutionSlugList = v.InferOutput<typeof InstitutionSlugListSchema>;

/**
 * The `status` filter is repeatable: a single occurrence (`?status=partner_institution`) arrives as
 * a string, multiple occurrences (`?status=partner_institution&status=none`) as an array. Both are
 * normalised to an array, and the matched institutions are the union of the requested statuses.
 */
const InstitutionStatusFilterSchema = v.union([
	v.array(v.picklist(institutionStatusEnum)),
	v.pipe(
		v.picklist(institutionStatusEnum),
		v.transform((value) => [value]),
	),
]);

export const InstitutionQuerySchema = v.object({
	...PaginationQuerySchema.entries,
	status: v.pipe(
		v.optional(InstitutionStatusFilterSchema),
		v.description("Filter institutions by their relation to the DARIAH-EU ERIC (repeatable)"),
		v.metadata({ ref: "InstitutionStatusParam" }),
	),
});

export const GetInstitutions = {
	QuerySchema: InstitutionQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: InstitutionListSchema,
		}),
		v.description("Paginated list of institutions"),
		v.metadata({ ref: "GetInstitutionsResponse" }),
	),
};

export const GetInstitutionById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get institution by id params"),
		v.metadata({ ref: "GetInstitutionByIdParams" }),
	),
	ResponseSchema: InstitutionSchema,
};

export const GetInstitutionSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: InstitutionSlugListSchema,
		}),
		v.description("Paginated list of institution slugs"),
		v.metadata({ ref: "GetInstitutionSlugsResponse" }),
	),
};

export const GetInstitutionBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get institution by slug params"),
		v.metadata({ ref: "GetInstitutionBySlugParams" }),
	),
	ResponseSchema: InstitutionSchema,
};
