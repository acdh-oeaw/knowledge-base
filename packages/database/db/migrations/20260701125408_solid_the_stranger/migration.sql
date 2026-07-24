--> statement-breakpoint
CREATE VIEW "document_lifecycle" AS
SELECT
	"entities"."id"                    AS "document_id",
	"entities"."type_id",
	"draft_versions"."id"              AS "draft_id",
	"draft_versions"."updated_at"      AS "draft_updated_at",
	"published_versions"."id"          AS "published_id",
	"published_versions"."updated_at"  AS "published_updated_at",
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
		AND "draft_versions"."locale_id" = (
			SELECT "id" FROM "locales" WHERE "is_default" = true
		)
	LEFT JOIN "entity_versions" "published_versions"
		ON "published_versions"."entity_id" = "entities"."id"
		AND "published_versions"."status_id" = (
			SELECT "id" FROM "entity_status" WHERE "type" = 'published'
		)
		AND "published_versions"."locale_id" = (
			SELECT "id" FROM "locales" WHERE "is_default" = true
		)
WHERE
	"draft_versions"."id" IS NOT NULL
	OR "published_versions"."id" IS NOT NULL;


--> statement-breakpoint
CREATE VIEW "statistics" AS
SELECT
  (
    SELECT COUNT(DISTINCT uv."entity_id")::integer
    FROM "organisational_units" u
    JOIN "entity_versions" uv ON uv."id" = u."id"
    JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
    JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'country'
    JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
    JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_member_of'
    JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
    JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
    JOIN "organisational_units" related ON related."id" = rv."id"
    JOIN "organisational_unit_types" related_t ON related."type_id" = related_t."id" AND related_t."type" = 'eric'
    JOIN "slugs" eric_s ON eric_s."entity_id" = r."related_unit_document_id" AND eric_s."value" = 'dariah-eu' AND eric_s."is_published" = true
  ) AS "member_countries",
  (
    SELECT COUNT(DISTINCT uv."entity_id")::integer
    FROM "organisational_units" u
    JOIN "entity_versions" uv ON uv."id" = u."id"
    JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
    JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'institution'
    JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
    JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" IN (
      'is_partner_institution_of',
      'is_national_coordinating_institution_in'
    )
    JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
    JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
    JOIN "organisational_units" umb ON umb."id" = rv."id"
    JOIN "organisational_unit_types" umb_t ON umb."type_id" = umb_t."id" AND umb_t."type" = 'eric'
    JOIN "slugs" eric_s ON eric_s."entity_id" = r."related_unit_document_id" AND eric_s."value" = 'dariah-eu' AND eric_s."is_published" = true
  ) AS "partner_institutions",
  (
    SELECT COUNT(DISTINCT uv."entity_id")::integer
    FROM "organisational_units" u
    JOIN "entity_versions" uv ON uv."id" = u."id"
    JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
    JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'institution'
    JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
    JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_cooperating_partner_of'
    JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
    JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
    JOIN "organisational_units" umb ON umb."id" = rv."id"
    JOIN "organisational_unit_types" umb_t ON umb."type_id" = umb_t."id" AND umb_t."type" = 'eric'
    JOIN "slugs" eric_s ON eric_s."entity_id" = r."related_unit_document_id" AND eric_s."value" = 'dariah-eu' AND eric_s."is_published" = true
  ) AS "cooperating_partners",
  (
    SELECT COUNT(DISTINCT uv."entity_id")::integer
    FROM "organisational_units" u
    JOIN "entity_versions" uv ON uv."id" = u."id"
    JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
    JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'working_group'
    JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
    JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" = 'is_part_of'
    JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
    JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
    JOIN "organisational_units" related ON related."id" = rv."id"
    JOIN "organisational_unit_types" related_t ON related."type_id" = related_t."id" AND related_t."type" = 'eric'
    JOIN "slugs" eric_s ON eric_s."entity_id" = r."related_unit_document_id" AND eric_s."value" = 'dariah-eu' AND eric_s."is_published" = true
  ) AS "working_groups";
