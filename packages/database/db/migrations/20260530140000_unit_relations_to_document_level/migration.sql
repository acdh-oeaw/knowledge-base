-- Move organisational-unit↔unit relations from version-id keys to document-id keys, mirroring the
-- persons/projects migrations. The members_and_partners, working_groups and statistics views depend
-- on the old columns, so they are dropped and recreated against the resolved (published) versions.
--
-- Idempotent: guarded on the old `unit_id` column still existing, so a re-run — or a run after
-- `db:push` produced the new shape — is a no-op (the views are then created by create_views).

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'organisational_units_to_units'
			AND column_name = 'unit_id'
	) THEN
		DROP VIEW IF EXISTS members_and_partners;
		DROP VIEW IF EXISTS working_groups;
		DROP VIEW IF EXISTS statistics;

		ALTER TABLE organisational_units_to_units
			ADD COLUMN IF NOT EXISTS unit_document_id uuid,
			ADD COLUMN IF NOT EXISTS related_unit_document_id uuid;

		UPDATE organisational_units_to_units r
		SET unit_document_id = uev.entity_id
		FROM entity_versions uev
		WHERE uev.id = r.unit_id;

		UPDATE organisational_units_to_units r
		SET related_unit_document_id = rev.entity_id
		FROM entity_versions rev
		WHERE rev.id = r.related_unit_id;

		-- Collapse only the lifecycle clone cross-product: rows sharing the same logical relation
		-- (unit document, related unit document, status) AND the same duration. Distinct,
		-- non-overlapping durations for the same triple are legitimate history (e.g. cooperating
		-- partner at different periods) and are preserved; the exclusion constraint added below still
		-- rejects overlapping ones. Prefer the row whose endpoints are both published, then lowest id.
		DROP TABLE IF EXISTS u2u_dedup;
		CREATE TEMP TABLE u2u_dedup ON COMMIT DROP AS
		SELECT
			r.id,
			row_number() OVER w AS rn
		FROM organisational_units_to_units r
		JOIN entity_versions uev ON uev.id = r.unit_id
		JOIN entity_status ust ON ust.id = uev.status_id
		JOIN entity_versions rev ON rev.id = r.related_unit_id
		JOIN entity_status rst ON rst.id = rev.status_id
		WINDOW w AS (
			PARTITION BY r.unit_document_id, r.related_unit_document_id, r.status, r.duration
			ORDER BY
				(CASE WHEN ust.type = 'published' AND rst.type = 'published' THEN 0 ELSE 1 END),
				r.id
		);

		DELETE FROM organisational_units_to_units r
		USING u2u_dedup d
		WHERE r.id = d.id AND d.rn > 1;

		DROP TABLE u2u_dedup;

		ALTER TABLE organisational_units_to_units
			DROP COLUMN unit_id,
			DROP COLUMN related_unit_id;

		ALTER TABLE organisational_units_to_units
			ALTER COLUMN unit_document_id SET NOT NULL,
			ALTER COLUMN related_unit_document_id SET NOT NULL;

		ALTER TABLE organisational_units_to_units
			ADD CONSTRAINT organisational_units_to_units_unit_document_id_entities_id_fk
				FOREIGN KEY (unit_document_id) REFERENCES entities (id),
			ADD CONSTRAINT organisational_units_to_units_related_unit_document_id_entities_id_fk
				FOREIGN KEY (related_unit_document_id) REFERENCES entities (id);

		-- Recreate the views against the new columns (resolving both endpoints to published versions).
		CREATE VIEW members_and_partners AS
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
			JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id" AND "units_s"."type" = 'published'
			JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id" AND "unit_types"."type" = 'country'
			JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id" AND "units_to_units"."duration" @> NOW()
			JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status" AND "unit_status"."status" IN ('is_member_of', 'is_observer_of')
			JOIN "entity_versions" "related_v" ON "related_v"."entity_id" = "units_to_units"."related_unit_document_id"
			JOIN "entity_status" "related_s" ON "related_s"."id" = "related_v"."status_id" AND "related_s"."type" = 'published'
			JOIN "organisational_units" "related_units" ON "related_units"."id" = "related_v"."id"
			JOIN "organisational_unit_types" "related_unit_types" ON "related_units"."type_id" = "related_unit_types"."id" AND "related_unit_types"."type" = 'eric'
		GROUP BY
			"units"."id", "units"."metadata", "units"."name", "units"."summary", "units"."updated_at",
			"unit_types"."type", "units"."image_id", "units"."sshoc_marketplace_actor_id", "unit_status"."status"
		UNION
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
			JOIN "entity_status" "countries_s" ON "countries_s"."id" = "countries_v"."status_id" AND "countries_s"."type" = 'published'
			JOIN "organisational_unit_types" "country_types" ON "countries"."type_id" = "country_types"."id" AND "country_types"."type" = 'country'
			JOIN "organisational_units_to_units" "located_in" ON "located_in"."related_unit_document_id" = "countries_v"."entity_id" AND "located_in"."duration" @> NOW()
			JOIN "organisational_unit_status" "located_in_status" ON "located_in_status"."id" = "located_in"."status" AND "located_in_status"."status" = 'is_located_in'
			JOIN "entity_versions" "institutions_v" ON "institutions_v"."entity_id" = "located_in"."unit_document_id"
			JOIN "entity_status" "institutions_s" ON "institutions_s"."id" = "institutions_v"."status_id" AND "institutions_s"."type" = 'published'
			JOIN "organisational_units" "institutions" ON "institutions"."id" = "institutions_v"."id"
			JOIN "organisational_unit_types" "institution_types" ON "institutions"."type_id" = "institution_types"."id" AND "institution_types"."type" = 'institution'
			JOIN "organisational_units_to_units" "coop_rel" ON "coop_rel"."unit_document_id" = "institutions_v"."entity_id" AND "coop_rel"."duration" @> NOW()
			JOIN "organisational_unit_status" "coop_status" ON "coop_status"."id" = "coop_rel"."status" AND "coop_status"."status" = 'is_cooperating_partner_of'
			JOIN "entity_versions" "eric_v" ON "eric_v"."entity_id" = "coop_rel"."related_unit_document_id"
			JOIN "entity_status" "eric_s" ON "eric_s"."id" = "eric_v"."status_id" AND "eric_s"."type" = 'published'
			JOIN "organisational_units" "eric_units" ON "eric_units"."id" = "eric_v"."id"
			JOIN "organisational_unit_types" "eric_types" ON "eric_units"."type_id" = "eric_types"."id" AND "eric_types"."type" = 'eric'
		GROUP BY
			"countries"."id", "countries"."metadata", "countries"."name", "countries"."summary", "countries"."updated_at",
			"country_types"."type", "countries"."image_id", "countries"."sshoc_marketplace_actor_id", "coop_status"."status";

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
			JOIN "entity_status" "units_s" ON "units_s"."id" = "units_v"."status_id" AND "units_s"."type" = 'published'
			JOIN "organisational_unit_types" "unit_types" ON "units"."type_id" = "unit_types"."id" AND "unit_types"."type" = 'working_group'
			JOIN "organisational_units_to_units" "units_to_units" ON "units_to_units"."unit_document_id" = "units_v"."entity_id"
			JOIN "organisational_unit_status" "unit_status" ON "unit_status"."id" = "units_to_units"."status"
		GROUP BY
			"units"."id", "units"."metadata", "units"."name", "units"."summary", "units"."updated_at",
			"unit_types"."type", "units"."image_id", "units"."sshoc_marketplace_actor_id", "unit_status"."status";

		CREATE VIEW statistics AS
		SELECT
			(
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
				SELECT COUNT(*)::integer
				FROM "organisational_units" u
				JOIN "entity_versions" uv ON uv."id" = u."id"
				JOIN "entity_status" us ON us."id" = uv."status_id" AND us."type" = 'published'
				JOIN "organisational_unit_types" t ON u."type_id" = t."id" AND t."type" = 'institution'
				JOIN "organisational_units_to_units" r ON r."unit_document_id" = uv."entity_id" AND r."duration" @> NOW()
				JOIN "organisational_unit_status" s ON r."status" = s."id" AND s."status" IN ('is_partner_institution_of', 'is_national_coordinating_institution_in')
				JOIN "entity_versions" rv ON rv."entity_id" = r."related_unit_document_id"
				JOIN "entity_status" rs ON rs."id" = rv."status_id" AND rs."type" = 'published'
				JOIN "organisational_units" umb ON umb."id" = rv."id"
				JOIN "organisational_unit_types" umb_t ON umb."type_id" = umb_t."id" AND umb_t."type" = 'eric'
			) AS "partner_institutions",
			(
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
	END IF;
END $$;
--> statement-breakpoint

-- A unit can hold the same relation to the same counterpart over several non-overlapping periods
-- (e.g. a cooperating partner of dariah-eric at different points in time). Enforce that with a GiST
-- exclusion constraint on the duration rather than a plain UNIQUE, which would reject the legitimate
-- repeat. Runs in both paths (fresh `db:push` and the column-swap above).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE organisational_units_to_units
	DROP CONSTRAINT IF EXISTS organisational_units_to_units_unit_related_status_unique;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'organisational_units_to_units_unit_related_status_no_overlap'
	) THEN
		ALTER TABLE organisational_units_to_units
			ADD CONSTRAINT organisational_units_to_units_unit_related_status_no_overlap
			EXCLUDE USING gist (
				unit_document_id WITH =,
				related_unit_document_id WITH =,
				status WITH =,
				duration WITH &&
			);
	END IF;
END $$;
