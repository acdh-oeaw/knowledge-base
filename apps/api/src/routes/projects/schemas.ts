import * as schema from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

import { ContentBlockSchema } from "@/lib/content-blocks";
import { ImageSchema, PaginatedResponseSchema, PaginationQuerySchema } from "@/lib/schemas";

export const ProjectOrganisationalUnitSchema = v.pipe(
	v.object({
		...v.pick(schema.OrganisationalUnitSelectSchema, ["id", "acronym", "name"]).entries,
		type: v.picklist(schema.organisationalUnitTypesEnum),
		socialMedia: v.array(
			v.object({
				url: v.string(),
				type: v.picklist(schema.socialMediaTypesEnum),
			}),
		),
		role: v.picklist(schema.projectRolesEnum),
	}),
	v.description("Project institution"),
	v.metadata({ ref: "ProjectInstitution" }),
);

export const ProjectSocialMediaSchema = v.pipe(
	v.object({
		...v.pick(schema.SocialMediaSelectSchema, ["id", "url"]).entries,
		type: v.picklist(schema.socialMediaTypesEnum),
	}),
	v.description("Project social media"),
	v.metadata({ ref: "ProjectSocialMedia" }),
);

export const ProjectBaseSchema = v.pipe(
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
		socialMedia: v.array(ProjectSocialMediaSchema),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
	}),
	v.description("Project"),
	v.metadata({ ref: "ProjectBase" }),
);

export type ProjectBase = v.InferOutput<typeof ProjectBaseSchema>;

export const ProjectListSchema = v.pipe(
	v.array(ProjectBaseSchema),
	v.description("List of projects"),
	v.metadata({ ref: "ProjectList" }),
);

export type ProjectList = v.InferOutput<typeof ProjectListSchema>;

export const ProjectSchema = v.pipe(
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
		socialMedia: v.array(ProjectSocialMediaSchema),
		funders: v.array(ProjectOrganisationalUnitSchema),
		partners: v.array(ProjectOrganisationalUnitSchema),
		publishedAt: v.pipe(v.string(), v.isoTimestamp()),
		description: v.optional(v.array(ContentBlockSchema), []),
	}),
	v.description("Project"),
	v.metadata({ ref: "Project" }),
);

export type Project = v.InferOutput<typeof ProjectSchema>;

export const ProjectSlugSchema = v.pipe(
	v.object({
		...v.pick(schema.ProjectSelectSchema, ["id"]).entries,
		entity: v.pick(schema.EntitySelectSchema, ["slug"]),
	}),
	v.description("Project slug"),
	v.metadata({ ref: "ProjectSlug" }),
);

export type ProjectSlug = v.InferOutput<typeof ProjectSlugSchema>;

export const ProjectSlugListSchema = v.pipe(
	v.array(ProjectSlugSchema),
	v.description("List of project slugs"),
	v.metadata({ ref: "ProjectSlugList" }),
);

export type ProjectSlugList = v.InferOutput<typeof ProjectSlugListSchema>;

export const ProjectQuerySchema = v.object({
	...PaginationQuerySchema.entries,
	status: v.pipe(
		v.optional(v.picklist(["active", "inactive"] as const)),
		v.description(
			"Filter by active (project duration contains current time) or inactive (project duration has ended)",
		),
		v.metadata({ ref: "ProjectStatusParam" }),
	),
});

export const GetProjects = {
	QuerySchema: ProjectQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: ProjectListSchema,
		}),
		v.description("Paginated list of projects"),
		v.metadata({ ref: "GetProjectsResponse" }),
	),
};

export const GetProjectById = {
	ParamsSchema: v.pipe(
		v.object({
			id: v.pipe(v.string(), v.uuid()),
		}),
		v.description("Get project by id params"),
		v.metadata({ ref: "GetProjectByIdParams" }),
	),
	ResponseSchema: ProjectSchema,
};

export const GetProjectSlugs = {
	QuerySchema: PaginationQuerySchema,
	ResponseSchema: v.pipe(
		v.object({
			...PaginatedResponseSchema.entries,
			data: ProjectSlugListSchema,
		}),
		v.description("Paginated list of project slugs"),
		v.metadata({ ref: "GetProjectSlugsResponse" }),
	),
};

export const GetProjectBySlug = {
	ParamsSchema: v.pipe(
		v.object({
			slug: v.string(),
		}),
		v.description("Get project by slug params"),
		v.metadata({ ref: "GetProjectBySlugParams" }),
	),
	ResponseSchema: ProjectSchema,
};
