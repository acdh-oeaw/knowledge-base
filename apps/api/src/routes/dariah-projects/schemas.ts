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

export const DariahProjectOrganisationalUnitsSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "acronym", "name"]).entries,
		socialMedia: v.array(
			v.object({
				url: v.string(),
				type: v.picklist(schema.socialMediaTypesEnum),
			}),
		),
		type: v.picklist(schema.organisationalUnitTypesEnum),
	}),
	v.description("DARIAH project institution"),
	v.metadata({ ref: "DariahProjectInstitution" }),
);

export const DariahProjectSocialMediaSchema = v.pipe(
	v.object({
		...v.pick(schema.SocialMediaSelectSchema, ["id", "url"]).entries,
		type: v.picklist(schema.socialMediaTypesEnum),
	}),
	v.description("DARIAH project social media"),
	v.metadata({ ref: "DariahProjectSocialMedia" }),
);

export const DariahProjectBaseSchema = v.pipe(
	v.object({
		...v.pick(schema.ProjectSelectSchema, [
			"id",
			"name",
			"acronym",
			"summary",
			"call",
			"topic",
			"funding",
		]).entries,
		duration: v.object({
			start: v.pipe(v.string(), v.isoTimestamp()),
			end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
		}),
		image: v.nullable(ImageSchema),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		scope: v.object({ scope: v.picklist(schema.projectScopesEnum) }),
		socialMedia: v.array(DariahProjectSocialMediaSchema),
		role: v.nullable(v.picklist(schema.projectRolesEnum)),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("DARIAH project"),
	v.metadata({ ref: "DariahProjectBase" }),
);

export type DariahProjectBase = v.InferOutput<typeof DariahProjectBaseSchema>;

export const DariahProjectListSchema = v.pipe(
	v.array(DariahProjectBaseSchema),
	v.description("List of DARIAH projects"),
	v.metadata({ ref: "DariahProjectList" }),
);

export type DariahProjectList = v.InferOutput<typeof DariahProjectListSchema>;

export const DariahProjectSchema = v.pipe(
	v.object({
		...v.pick(schema.ProjectSelectSchema, [
			"id",
			"name",
			"acronym",
			"summary",
			"call",
			"topic",
			"funding",
		]).entries,
		image: v.nullable(ImageSchema),
		duration: v.object({
			start: v.pipe(v.string(), v.isoTimestamp()),
			end: v.optional(v.pipe(v.string(), v.isoTimestamp())),
		}),
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
		scope: v.object({ scope: v.picklist(schema.projectScopesEnum) }),
		socialMedia: v.array(DariahProjectSocialMediaSchema),
		participants: v.array(DariahProjectOrganisationalUnitsSchema),
		coordinators: v.array(DariahProjectOrganisationalUnitsSchema),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		description: v.optional(v.array(ContentBlockSchema), []),
		relatedEntities: v.optional(RelatedEntitiesSchema, []),
		relatedResources: v.optional(RelatedResourcesSchema, []),
	}),
	v.description("DARIAH project"),
	v.metadata({ ref: "DariahProject" }),
);

export type DariahProject = v.InferOutput<typeof DariahProjectSchema>;

export const DariahProjectSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.ProjectSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("DARIAH project slug"),
	v.metadata({ ref: "DariahProjectSlug" }),
);

export type DariahProjectSlug = v.InferOutput<typeof DariahProjectSlugSchema>;

export const DariahProjectSlugListSchema = v.pipe(
	v.array(DariahProjectSlugSchema),
	v.description("List of DARIAH project slugs"),
	v.metadata({ ref: "DariahProjectSlugList" }),
);

export type DariahProjectSlugList = v.InferOutput<typeof DariahProjectSlugListSchema>;

export const DariahProjectQuerySchema = v.object({
	...PaginationQuerySchema.entries,
	status: v.pipe(
		v.optional(v.picklist(["active", "inactive"] as const)),
		v.description(
			"Filter by active (project duration contains current time) or inactive (project duration has ended)",
		),
		v.metadata({ ref: "DariahProjectStatusParam" }),
	),
});

export const GetDariahProjects = {
	QuerySchema: DariahProjectQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: DariahProjectListSchema,
		}),
		v.description("Paginated list of DARIAH projects"),
		v.metadata({ ref: "GetDariahProjectsResponse" }),
	),
};

export const GetDariahProjectById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get DARIAH project by id params"),
		v.metadata({ ref: "GetDariahProjectByIdParams" }),
	),
	ResponseSchema: DariahProjectSchema,
};

export const GetDariahProjectSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: DariahProjectSlugListSchema,
		}),
		v.description("Paginated list of DARIAH project slugs"),
		v.metadata({ ref: "GetDariahProjectSlugsResponse" }),
	),
};

export const GetDariahProjectBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get DARIAH project by slug params"),
		v.metadata({ ref: "GetDariahProjectBySlugParams" }),
	),
	ResponseSchema: DariahProjectSchema,
};
