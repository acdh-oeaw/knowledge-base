import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { entities, entityVersions } from "./entities";
import { socialMedia } from "./social-media";

export const projectScopesEnum = ["eu", "national", "regional"] as const;

export const projectScopes = p.snakeCase.table(
	"project_scopes",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		scope: p.text("scope", { enum: projectScopesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("project_scopes_scope_enum_check", inArray(t.scope, projectScopesEnum))],
);

export type ProjectScope = typeof projectScopes.$inferSelect;
export type ProjectScopeInput = typeof projectScopes.$inferInsert;

export const projectRolesEnum = [
	"coordinator",
	"funder",
	"participant",
	/** "third_party" */ "affiliated",
] as const;

export const projectRoles = p.snakeCase.table(
	"project_roles",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		role: p.text("role", { enum: projectRolesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("project_roles_role_enum_check", inArray(t.role, projectRolesEnum))],
);

export type ProjectRole = typeof projectRoles.$inferSelect;
export type ProjectRoleInput = typeof projectRoles.$inferInsert;

export const projects = p.snakeCase.table("projects", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	metadata: p.jsonb("metadata"),
	name: p.text("name").notNull(),
	acronym: p.text("acronym"),
	duration: f.timestampRange("duration").notNull(),
	funding: p.numeric("funding", { mode: "number", precision: 12, scale: 2 }),
	summary: p.text("summary").notNull(),
	call: p.text("call"),
	topic: p.text("topic"),
	imageId: p.uuid("image_id").references(() => assets.id),
	scopeId: p
		.uuid("scope_id")
		.notNull()
		.references(() => projectScopes.id),
	...f.timestamps(),
});

export type Project = typeof projects.$inferSelect;
export type ProjectInput = typeof projects.$inferInsert;

export const ProjectSelectSchema = createSelectSchema(projects, { duration: f.TimestampRange });
export const ProjectInsertSchema = createInsertSchema(projects, { duration: f.TimestampRange });
export const ProjectUpdateSchema = createUpdateSchema(projects, { duration: f.TimestampRange });

/**
 * Document-level relation: a project's partner organisational unit in a given role. Both endpoints
 * reference `entities.id` (document IDs), not version IDs, so the relation is stable across the
 * draft/publish lifecycle of either side and is never cloned by the lifecycle adapters. Public
 * reads resolve each endpoint through its published version; admin reads through
 * draft-or-published.
 */
export const projectsToOrganisationalUnits = p.snakeCase.table(
	"projects_to_organisational_units",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		projectDocumentId: p
			.uuid("project_document_id")
			.notNull()
			.references(() => entities.id),
		unitDocumentId: p
			.uuid("unit_document_id")
			.notNull()
			.references(() => entities.id),
		roleId: p
			.uuid("role_id")
			.notNull()
			.references(() => projectRoles.id),
		duration: f.timestampRange("duration"),
	},
	// Unlike person↔org / org↔org, a project partnership is not temporal: the same unit cannot be a
	// partner of the same project in the same role twice (duration is usually empty / the project's
	// own duration), so a plain unique on (project, unit, role) is correct here.
	(t) => [
		p
			.unique("projects_to_organisational_units_project_role_unit_unique")
			.on(t.projectDocumentId, t.roleId, t.unitDocumentId),
	],
);

export type ProjectToOrganisationalUnit = typeof projectsToOrganisationalUnits.$inferSelect;
export type ProjectToOrganisationalUnitInput = typeof projectsToOrganisationalUnits.$inferInsert;

export const ProjectToOrganisationalUnitSelectSchema = createSelectSchema(
	projectsToOrganisationalUnits,
	{
		duration: f.NullableTimestampRange,
	},
);
export const ProjectToOrganisationalUnitInsertSchema = createInsertSchema(
	projectsToOrganisationalUnits,
	{
		duration: f.NullableTimestampRange,
	},
);
export const ProjectToOrganisationalUnitUpdateSchema = createUpdateSchema(
	projectsToOrganisationalUnits,
	{
		duration: f.NullableTimestampRange,
	},
);

export const projectsToSocialMedia = p.snakeCase.table("projects_to_social_media", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	projectId: p
		.uuid("project_id")
		.notNull()
		.references(() => projects.id),
	socialMediaId: p
		.uuid("social_media_id")
		.notNull()
		.references(() => socialMedia.id),
	...f.timestamps(),
});

export type ProjectToSocialMedia = typeof projectsToSocialMedia.$inferSelect;
export type ProjectToSocialMediaInput = typeof projectsToSocialMedia.$inferInsert;

export const ProjectToSocialMediaSelectSchema = createSelectSchema(projectsToSocialMedia);
export const ProjectToSocialMediaInsertSchema = createInsertSchema(projectsToSocialMedia);
export const ProjectToSocialMediaUpdateSchema = createUpdateSchema(projectsToSocialMedia);

export const dariahProjectsUnitType = "eric";

export const dariahProjects = p.snakeCase
	.view("dariah_projects", {
		id: p.uuid("id").notNull(),
		metadata: p.jsonb("metadata"),
		name: p.text("name").notNull(),
		acronym: p.text("acronym"),
		summary: p.text("summary").notNull(),
		updatedAt: f.timestamp("updated_at").notNull(),
		duration: f.timestampRange("duration").notNull(),
		call: p.text("call").notNull(),
		topic: p.text("topic").notNull(),
		funding: p.numeric("funding", { mode: "number", precision: 12, scale: 2 }),
		imageId: p.uuid("image_id"),
		scopeId: p.uuid("scope_id").notNull(),
	})
	.existing();
