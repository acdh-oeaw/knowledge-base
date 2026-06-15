DROP VIEW statistics;

--> statement-breakpoint
-- Unit↔unit relations are document-level; resolve both endpoints to their published versions.
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
