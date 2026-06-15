ALTER TABLE "entity_types" DROP CONSTRAINT "entity_types_type_enum_check";

--> statement-breakpoint
ALTER TABLE "entity_types"
ADD CONSTRAINT "entity_types_type_enum_check" CHECK (
	"type" IN (
		'documentation_pages',
		'documents_policies',
		'events',
		'external_links',
		'funding_calls',
		'impact_case_studies',
		'internal_pages',
		'news',
		'opportunities',
		'organisational_units',
		'pages',
		'persons',
		'projects',
		'spotlight_articles'
	)
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "internal_pages" (
	"id" uuid PRIMARY KEY NOT NULL REFERENCES "entity_versions" ("id"),
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
INSERT INTO
	"entity_types" ("type")
VALUES
	('internal_pages')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"entity_types_fields_names" ("entity_type_id", "field_name")
SELECT
	"entity_types"."id",
	"fields"."field_name"
FROM
	"entity_types"
	CROSS JOIN (
		VALUES
			('content')
	) AS "fields" ("field_name")
WHERE
	"entity_types"."type" = 'internal_pages'
ON CONFLICT ("entity_type_id", "field_name") DO NOTHING;

--> statement-breakpoint
WITH "internal_type" AS (
	SELECT
		"id"
	FROM
		"entity_types"
	WHERE
		"type" = 'internal_pages'
),
"draft_status" AS (
	SELECT
		"id"
	FROM
		"entity_status"
	WHERE
		"type" = 'draft'
),
"published_status" AS (
	SELECT
		"id"
	FROM
		"entity_status"
	WHERE
		"type" = 'published'
),
"source" ("slug", "title") AS (
	VALUES
		('privacy-policy', 'Privacy policy'),
		('terms-of-use', 'Terms of use')
),
"inserted_entities" AS (
	INSERT INTO
		"entities" ("type_id", "slug")
	SELECT
		"internal_type"."id",
		"source"."slug"
	FROM
		"source",
		"internal_type"
	ON CONFLICT ("type_id", "slug") DO UPDATE
	SET
		"slug" = EXCLUDED."slug"
	RETURNING
		"id",
		"slug"
),
"inserted_versions" AS (
	INSERT INTO
		"entity_versions" ("entity_id", "status_id")
	SELECT
		"inserted_entities"."id",
		"published_status"."id"
	FROM
		"inserted_entities",
		"published_status"
	UNION ALL
	SELECT
		"inserted_entities"."id",
		"draft_status"."id"
	FROM
		"inserted_entities",
		"draft_status"
	ON CONFLICT ("entity_id", "status_id") DO UPDATE
	SET
		"entity_id" = EXCLUDED."entity_id"
	RETURNING
		"id",
		"entity_id"
),
"inserted_internal_pages" AS (
	INSERT INTO
		"internal_pages" ("id", "title")
	SELECT
		"inserted_versions"."id",
		"source"."title"
	FROM
		"inserted_versions"
		JOIN "inserted_entities" ON "inserted_entities"."id" = "inserted_versions"."entity_id"
		JOIN "source" ON "source"."slug" = "inserted_entities"."slug"
	ON CONFLICT ("id") DO NOTHING
	RETURNING
		"id"
)
INSERT INTO
	"fields" ("entity_version_id", "field_name_id")
SELECT
	"inserted_versions"."id",
	"entity_types_fields_names"."id"
FROM
	"inserted_versions"
	JOIN "entity_versions" ON "entity_versions"."id" = "inserted_versions"."id"
	JOIN "entities" ON "entities"."id" = "entity_versions"."entity_id"
	JOIN "entity_types" ON "entity_types"."id" = "entities"."type_id"
	JOIN "entity_types_fields_names" ON "entity_types_fields_names"."entity_type_id" = "entity_types"."id"
	AND "entity_types_fields_names"."field_name" = 'content'
ON CONFLICT ("entity_version_id", "field_name_id") DO NOTHING;
