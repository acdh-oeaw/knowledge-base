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

const GovernanceBodyPersonSchema = v.object({
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
	slug: v.string(),
	role: v.picklist(schema.personRoleTypesEnum),
	duration: v.object({
		start: v.string(),
		end: v.nullable(v.string()),
	}),
});

export const GovernanceBodyBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, [
			"id",
			"name",
			"acronym",
			"summary",
			"metadata",
		]).entries,
		image: v.nullable(ImageSchema),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		socialMedia: v.array(
			v.object({
				...v.pick(schema.SocialMediaSelectSchema, ["id", "name", "url"]).entries,
				duration: v.object({
					start: v.string(),
					end: v.nullable(v.string()),
				}),
				type: v.picklist(schema.socialMediaTypesEnum),
			}),
		),
		persons: v.array(GovernanceBodyPersonSchema),
	}),
	v.description("Governance body"),
	v.metadata({ ref: "GovernanceBodyBase" }),
);

export type GovernanceBodyBase = v.InferOutput<typeof GovernanceBodyBaseSchema>;

export const GovernanceBodyListSchema = v.pipe(
	v.array(GovernanceBodyBaseSchema),
	v.description("List of governance bodies"),
	v.metadata({ ref: "GovernanceBodyList" }),
);

export type GovernanceBodyList = v.InferOutput<typeof GovernanceBodyListSchema>;

export const GovernanceBodySchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, [
			"id",
			"name",
			"acronym",
			"summary",
			"metadata",
		]).entries,
		image: v.nullable(ImageSchema),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		socialMedia: v.array(
			v.object({
				...v.pick(schema.SocialMediaSelectSchema, ["id", "name", "url"]).entries,
				duration: v.object({
					start: v.string(),
					end: v.nullable(v.string()),
				}),
				type: v.picklist(schema.socialMediaTypesEnum),
			}),
		),
		persons: v.array(GovernanceBodyPersonSchema),
		description: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("Governance body"),
	v.metadata({ ref: "GovernanceBody" }),
);

export type GovernanceBody = v.InferOutput<typeof GovernanceBodySchema>;

export const GovernanceBodySlugSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Governance body slug"),
	v.metadata({ ref: "GovernanceBodySlug" }),
);

export type GovernanceBodySlug = v.InferOutput<typeof GovernanceBodySlugSchema>;

export const GovernanceBodySlugListSchema = v.pipe(
	v.array(GovernanceBodySlugSchema),
	v.description("List of governance body slugs"),
	v.metadata({ ref: "GovernanceBodySlugList" }),
);

export type GovernanceBodySlugList = v.InferOutput<typeof GovernanceBodySlugListSchema>;

export const GetGovernanceBodies = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: GovernanceBodyListSchema,
		}),
		v.description("Paginated list of governance bodies"),
		v.metadata({ ref: "GetGovernanceBodiesResponse" }),
	),
};

export const GetGovernanceBodyById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get governance body by id params"),
		v.metadata({ ref: "GetGovernanceBodyByIdParams" }),
	),
	ResponseSchema: GovernanceBodySchema,
};

export const GetGovernanceBodySlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: GovernanceBodySlugListSchema,
		}),
		v.description("Paginated list of governance body slugs"),
		v.metadata({ ref: "GetGovernanceBodySlugsResponse" }),
	),
};

export const GetGovernanceBodyBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get governance body by slug params"),
		v.metadata({ ref: "GetGovernanceBodyBySlugParams" }),
	),
	ResponseSchema: GovernanceBodySchema,
};
