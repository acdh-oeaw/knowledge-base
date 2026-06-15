-- Move person↔organisational-unit relations from version-id keys to document-id keys.
--
-- Previously `persons_to_organisational_units.person_id` / `organisational_unit_id` referenced
-- entity *version* ids and the lifecycle adapters cloned the rows per version, producing a version
-- cross-product (duplicate relations). The relation is now document-level (keyed by `entities.id`),
-- like `entities_to_entities`: one row per logical relation, resolved to the published/draft version
-- at read time. This migration backfills document ids, collapses the cross-product duplicates
-- (repointing claimed country-report contributions onto the surviving row), and swaps the columns.
--
-- Idempotent: `db:push` may already have brought the table into its new (document-id) shape before
-- this runs. The whole transform is therefore guarded on the old `person_id` column still existing,
-- so re-runs — and runs after `db:push` — are no-ops.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'persons_to_organisational_units'
			AND column_name = 'person_id'
	) THEN
		ALTER TABLE persons_to_organisational_units
			ADD COLUMN IF NOT EXISTS person_document_id uuid,
			ADD COLUMN IF NOT EXISTS organisational_unit_document_id uuid;

		-- Backfill document ids from the referenced version ids.
		UPDATE persons_to_organisational_units p
		SET person_document_id = pev.entity_id
		FROM entity_versions pev
		WHERE pev.id = p.person_id;

		UPDATE persons_to_organisational_units p
		SET organisational_unit_document_id = oev.entity_id
		FROM entity_versions oev
		WHERE oev.id = p.organisational_unit_id;

		-- Collapse only the lifecycle clone cross-product: rows that share the same logical relation
		-- (person document, org document, role) AND the same duration. Distinct, non-overlapping
		-- durations for the same triple are legitimate history (e.g. affiliated at different periods)
		-- and are preserved; the exclusion constraint added below still rejects overlapping ones.
		DROP TABLE IF EXISTS p2o_dedup;
		CREATE TEMP TABLE p2o_dedup ON COMMIT DROP AS
		SELECT
			p.id,
			row_number() OVER w AS rn,
			first_value(p.id) OVER w AS keep_id
		FROM persons_to_organisational_units p
		JOIN entity_versions pev ON pev.id = p.person_id
		JOIN entity_status pst ON pst.id = pev.status_id
		JOIN entity_versions oev ON oev.id = p.organisational_unit_id
		JOIN entity_status ost ON ost.id = oev.status_id
		WINDOW w AS (
			PARTITION BY
				p.person_document_id, p.organisational_unit_document_id, p.role_type_id, p.duration
			ORDER BY
				(CASE WHEN pst.type = 'published' AND ost.type = 'published' THEN 0 ELSE 1 END),
				p.created_at,
				p.id
		);

		-- Repoint claimed country-report contributions from duplicate rows onto the surviving row,
		-- unless that would collide with an existing claim for the same report.
		UPDATE country_report_contributions crc
		SET person_to_org_unit_id = d.keep_id
		FROM p2o_dedup d
		WHERE crc.person_to_org_unit_id = d.id
			AND d.rn > 1
			AND NOT EXISTS (
				SELECT 1
				FROM country_report_contributions existing
				WHERE existing.country_report_id = crc.country_report_id
					AND existing.person_to_org_unit_id = d.keep_id
			);

		-- Drop any contributions still pointing at duplicates (collision cases handled above).
		DELETE FROM country_report_contributions crc
		USING p2o_dedup d
		WHERE crc.person_to_org_unit_id = d.id AND d.rn > 1;

		-- Remove the duplicate relation rows.
		DELETE FROM persons_to_organisational_units p
		USING p2o_dedup d
		WHERE p.id = d.id AND d.rn > 1;

		DROP TABLE p2o_dedup;

		-- Swap the columns: dropping a column drops its single-column FK automatically.
		ALTER TABLE persons_to_organisational_units
			DROP COLUMN person_id,
			DROP COLUMN organisational_unit_id;

		ALTER TABLE persons_to_organisational_units
			ALTER COLUMN person_document_id SET NOT NULL,
			ALTER COLUMN organisational_unit_document_id SET NOT NULL;

		ALTER TABLE persons_to_organisational_units
			ADD CONSTRAINT persons_to_organisational_units_person_document_id_entities_id_fk
				FOREIGN KEY (person_document_id) REFERENCES entities (id),
			ADD CONSTRAINT persons_to_organisational_units_organisational_unit_document_id_entities_id_fk
				FOREIGN KEY (organisational_unit_document_id) REFERENCES entities (id);
	END IF;
END $$;
--> statement-breakpoint

-- A person can hold the same role at the same organisational unit over several non-overlapping
-- periods (e.g. affiliated, left, re-affiliated). Enforce that with a GiST exclusion constraint on
-- the duration rather than a plain UNIQUE, which would have rejected the legitimate repeat. Runs in
-- both paths (fresh `db:push` and the column-swap above), so it is added outside the guarded block.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE persons_to_organisational_units
	DROP CONSTRAINT IF EXISTS persons_to_organisational_units_person_org_role_unique;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'persons_to_organisational_units_person_org_role_no_overlap'
	) THEN
		ALTER TABLE persons_to_organisational_units
			ADD CONSTRAINT persons_to_organisational_units_person_org_role_no_overlap
			EXCLUDE USING gist (
				person_document_id WITH =,
				organisational_unit_document_id WITH =,
				role_type_id WITH =,
				duration WITH &&
			);
	END IF;
END $$;
