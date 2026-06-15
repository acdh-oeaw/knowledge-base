-- Move the project reference in country_report_project_contributions from a version-id key to a
-- document-id key. A report contribution only identifies *which project* a country funded; keying it
-- by `entities.id` makes that identity stable across the project's draft/publish lifecycle, instead
-- of dangling whenever the project is re-published under a new version id. This brings the table in
-- line with every other reporting reference (country / working group / institution), which were
-- already moved to document-level keys.
--
-- Dropping the old column automatically drops its FK and the (country_report_id, project_id) unique,
-- so the block re-adds the FK and unique on the new column. Idempotent: guarded on the old
-- `project_id` column still existing, so a re-run — or a run after `db:push` has already produced the
-- new shape — is a no-op. The backfill keeps one contribution per (report, project document); if two
-- version-keyed rows collapse to the same document the dedup keeps the lowest id and the new unique
-- holds.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'country_report_project_contributions'
			AND column_name = 'project_id'
	) THEN
		ALTER TABLE country_report_project_contributions
			ADD COLUMN IF NOT EXISTS project_document_id uuid;

		UPDATE country_report_project_contributions c
		SET project_document_id = ev.entity_id
		FROM entity_versions ev
		WHERE ev.id = c.project_id;

		-- collapse any rows whose two project versions resolve to the same project document, keeping the
		-- lowest id so the new (report, document) unique holds.
		DELETE FROM country_report_project_contributions c
		USING (
			SELECT id, row_number() OVER (
				PARTITION BY country_report_id, project_document_id ORDER BY id
			) AS rn
			FROM country_report_project_contributions
		) d
		WHERE c.id = d.id AND d.rn > 1;

		ALTER TABLE country_report_project_contributions DROP COLUMN project_id;

		ALTER TABLE country_report_project_contributions
			ALTER COLUMN project_document_id SET NOT NULL;

		ALTER TABLE country_report_project_contributions
			ADD CONSTRAINT country_report_project_contributions_project_doc_entities_fk
				FOREIGN KEY (project_document_id) REFERENCES entities (id),
			ADD CONSTRAINT country_report_project_contributions_report_project_doc_unique
				UNIQUE (country_report_id, project_document_id);
	END IF;
END $$;
