-- `dariah_projects` selects `projects`."call" directly, so it must be dropped before that column
-- changes shape and recreated afterwards with the same name.
DROP VIEW "dariah_projects";
--> statement-breakpoint

CREATE TABLE "project_calls" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"call" text NOT NULL UNIQUE,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_calls_call_enum_check" CHECK ("call" in ('clariah_at_project_funding', 'go_digital_1_0', 'go_digital_2_0', 'go_digital_3_0', 'go_digital_next_generation'))
);
--> statement-breakpoint

-- Seeded here (rather than only in the CMS seed script, like `project_scopes`/`project_roles`) so the
-- FK below has rows to point to regardless of whether/when that script runs.
INSERT INTO "project_calls" ("call")
VALUES
	('clariah_at_project_funding'),
	('go_digital_1_0'),
	('go_digital_2_0'),
	('go_digital_3_0'),
	('go_digital_next_generation')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- The old `call` column was freeform text and never held one of the fixed values above, so there is
-- nothing worth carrying over — added fresh (nullable, no cast) and the old column is simply dropped.
ALTER TABLE "projects" ADD COLUMN "call_id" uuid;
--> statement-breakpoint

ALTER TABLE "projects" ADD CONSTRAINT "projects_call_id_project_calls_id_fkey" FOREIGN KEY ("call_id") REFERENCES "project_calls"("id");
--> statement-breakpoint

ALTER TABLE "projects" DROP COLUMN "call";
--> statement-breakpoint

CREATE VIEW dariah_projects AS
SELECT DISTINCT
	"projects"."id",
	"projects"."metadata",
	"projects"."name",
	"projects"."acronym",
	"projects"."summary",
	"projects"."duration",
	"projects"."call_id",
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
	JOIN "organisational_unit_types" ON "organisational_unit_types"."id" = "organisational_units"."type_id" AND "organisational_unit_types"."type" = 'eric'
	JOIN "project_roles" ON "project_roles"."id" = "projects_to_organisational_units"."role_id" AND "project_roles"."role" IN ('coordinator', 'participant');
