CREATE INDEX IF NOT EXISTS "entity_versions_entity_status_idx"
	ON "entity_versions" ("entity_id", "status_id");

--> statement-breakpoint
CREATE VIEW document_lifecycle AS
SELECT
	"entities"."id" AS "document_id",
	"entities"."type_id",
	"draft_versions"."id" AS "draft_id",
	"draft_versions"."updated_at" AS "draft_updated_at",
	"published_versions"."id" AS "published_id",
	"published_versions"."updated_at" AS "published_updated_at",
	(
		"draft_versions"."id" IS NOT NULL
		AND (
			"published_versions"."id" IS NULL
			OR "draft_versions"."updated_at" > "published_versions"."updated_at"
		)
	) AS "has_draft_changes",
	CASE
		WHEN "draft_versions"."id" IS NOT NULL
			AND "published_versions"."id" IS NOT NULL
			AND "draft_versions"."updated_at" > "published_versions"."updated_at"
		THEN 'published_with_changes'
		WHEN "published_versions"."id" IS NOT NULL
		THEN 'published'
		ELSE 'draft'
	END AS "state"
FROM
	"entities"
	LEFT JOIN "entity_versions" "draft_versions"
		ON "draft_versions"."entity_id" = "entities"."id"
		AND "draft_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'draft'
		)
	LEFT JOIN "entity_versions" "published_versions"
		ON "published_versions"."entity_id" = "entities"."id"
		AND "published_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'published'
		)
WHERE
	"draft_versions"."id" IS NOT NULL
	OR "published_versions"."id" IS NOT NULL;
