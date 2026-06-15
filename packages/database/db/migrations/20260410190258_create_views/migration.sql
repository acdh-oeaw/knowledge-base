CREATE VIEW members_and_partners AS
-- Countries with a direct member or observer relation to eric
SELECT
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."summary",
	"units"."updated_at",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_types"."type",
	"unit_status"."status"
FROM
	"organisational_units" "units"
	JOIN "entity_versions" "units_v" ON "units_v"."id" = "units"."id"
	JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id"
	AND "units_s"."type" = 'published'
	JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id"
	AND "unit_types"."type" = 'country'
	JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id"
	AND "units_to_units"."duration" @> NOW()
	JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status"
	AND "unit_status"."status" IN ('is_member_of', 'is_observer_of')
	JOIN "entity_versions" "related_v" ON "related_v"."entity_id" = "units_to_units"."related_unit_document_id"
	JOIN "entity_status" "related_s" ON "related_s"."id" = "related_v"."status_id"
	AND "related_s"."type" = 'published'
	JOIN "organisational_units" "related_units" ON "related_units"."id" = "related_v"."id"
	JOIN "organisational_unit_types" "related_unit_types" ON "related_units"."type_id" = "related_unit_types"."id"
	AND "related_unit_types"."type" = 'eric'
GROUP BY
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."summary",
	"units"."updated_at",
	"unit_types"."type",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_status"."status"

UNION

-- Countries that have at least one cooperating partner institution located in them
SELECT
	"countries"."id",
	"countries"."metadata",
	"countries"."name",
	"countries"."summary",
	"countries"."updated_at",
	"countries"."image_id",
	"countries"."sshoc_marketplace_actor_id",
	"country_types"."type",
	"coop_status"."status"
FROM
	"organisational_units" "countries"
	JOIN "entity_versions" "countries_v" ON "countries_v"."id" = "countries"."id"
	JOIN "entity_status" "countries_s" ON "countries_s"."id" = "countries_v"."status_id"
	AND "countries_s"."type" = 'published'
	JOIN "organisational_unit_types" "country_types" ON "countries"."type_id" = "country_types"."id"
	AND "country_types"."type" = 'country'
	JOIN "organisational_units_to_units" "located_in" ON "located_in"."related_unit_document_id" = "countries_v"."entity_id"
	AND "located_in"."duration" @> NOW()
	JOIN "organisational_unit_status" "located_in_status" ON "located_in_status"."id" = "located_in"."status"
	AND "located_in_status"."status" = 'is_located_in'
	JOIN "entity_versions" "institutions_v" ON "institutions_v"."entity_id" = "located_in"."unit_document_id"
	JOIN "entity_status" "institutions_s" ON "institutions_s"."id" = "institutions_v"."status_id"
	AND "institutions_s"."type" = 'published'
	JOIN "organisational_units" "institutions" ON "institutions"."id" = "institutions_v"."id"
	JOIN "organisational_unit_types" "institution_types" ON "institutions"."type_id" = "institution_types"."id"
	AND "institution_types"."type" = 'institution'
	JOIN "organisational_units_to_units" "coop_rel" ON "coop_rel"."unit_document_id" = "institutions_v"."entity_id"
	AND "coop_rel"."duration" @> NOW()
	JOIN "organisational_unit_status" "coop_status" ON "coop_status"."id" = "coop_rel"."status"
	AND "coop_status"."status" = 'is_cooperating_partner_of'
	JOIN "entity_versions" "eric_v" ON "eric_v"."entity_id" = "coop_rel"."related_unit_document_id"
	JOIN "entity_status" "eric_s" ON "eric_s"."id" = "eric_v"."status_id"
	AND "eric_s"."type" = 'published'
	JOIN "organisational_units" "eric_units" ON "eric_units"."id" = "eric_v"."id"
	JOIN "organisational_unit_types" "eric_types" ON "eric_units"."type_id" = "eric_types"."id"
	AND "eric_types"."type" = 'eric'
GROUP BY
	"countries"."id",
	"countries"."metadata",
	"countries"."name",
	"countries"."summary",
	"countries"."updated_at",
	"country_types"."type",
	"countries"."image_id",
	"countries"."sshoc_marketplace_actor_id",
	"coop_status"."status";

--> statement-breakpoint
CREATE VIEW working_groups AS
SELECT
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."summary",
	"units"."updated_at",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_types"."type",
	"unit_status"."status"
FROM
	"organisational_units" "units"
	JOIN "entity_versions" "units_v" ON "units_v"."id" = "units"."id"
	JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id"
	AND "units_s"."type" = 'published'
	JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id"
	AND "unit_types"."type" = 'working_group'
	JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id"
	JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status"
GROUP BY
	"units"."id",
	"units"."metadata",
	"units"."name",
	"units"."summary",
	"units"."updated_at",
	"unit_types"."type",
	"units"."image_id",
	"units"."sshoc_marketplace_actor_id",
	"unit_status"."status";

--> statement-breakpoint
CREATE VIEW dariah_projects AS
SELECT DISTINCT
	"projects"."id",
	"projects"."metadata",
	"projects"."name",
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

--> statement-breakpoint
CREATE VIEW statistics AS
SELECT
  (
    -- Countries with an active is_member_of relation to eric
    SELECT COUNT(*)::integer
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
  ) AS "member_countries",
  (
    -- Institutions with an active partner or national-coordinating relation to eric
    SELECT COUNT(*)::integer
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
  ) AS "partner_institutions",
  (
    -- Institutions with an active is_cooperating_partner_of relation to eric
    SELECT COUNT(*)::integer
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
  ) AS "cooperating_partners",
  (
    -- Working groups with an active is_part_of relation to eric
    SELECT COUNT(*)::integer
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
  ) AS "working_groups";
