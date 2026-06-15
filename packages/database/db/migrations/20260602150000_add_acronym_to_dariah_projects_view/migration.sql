DROP VIEW IF EXISTS dariah_projects;

--> statement-breakpoint

CREATE VIEW dariah_projects AS
SELECT DISTINCT
	"projects"."id",
	"projects"."metadata",
	"projects"."name",
	"projects"."acronym",
	"projects"."summary",
	"projects"."duration",
	"projects"."call",
	"projects"."topic",
	"projects"."funding",
	"projects"."image_id",
	"projects"."scope_id",
	"projects"."created_at",
	"projects"."updated_at"
FROM
	"projects"
	JOIN "entity_versions" "project_version" ON "project_version"."id" = "projects"."id"
	JOIN "projects_to_organisational_units" ON "projects_to_organisational_units"."project_document_id" = "project_version"."entity_id"
	JOIN "entity_versions" "unit_version" ON "unit_version"."entity_id" = "projects_to_organisational_units"."unit_document_id"
	JOIN "organisational_units" ON "organisational_units"."id" = "unit_version"."id"
	JOIN "organisational_unit_types" ON "organisational_unit_types"."id" = "organisational_units"."type_id"
	AND "organisational_unit_types"."type" = 'eric'
	JOIN "project_roles" ON "project_roles"."id" = "projects_to_organisational_units"."role_id"
	AND "project_roles"."role" IN ('coordinator', 'participant');
