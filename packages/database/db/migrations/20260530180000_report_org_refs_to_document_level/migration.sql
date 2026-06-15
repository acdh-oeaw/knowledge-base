-- Move the organisational-unit references in the reporting tables from version-id keys to document-id
-- keys. Reports are standalone records (not versioned entities), so these columns only identify which
-- country / working group / institution a report row is about; keying them by `entities.id` makes that
-- identity stable across the org unit's draft/publish lifecycle.
--
-- Columns moved (all → entities.id):
--   country_reports.country_id                      → country_document_id
--   working_group_reports.working_group_id          → working_group_document_id
--   country_report_institutions.organisational_unit_id → organisational_unit_document_id
--   reporting_campaign_country_thresholds.country_id   → country_document_id
--
-- Dropping the old column automatically drops its FK and the (multi-column) unique that involved it,
-- so each block re-adds the FK and unique on the new column. Idempotent: each block is guarded on its
-- old column still existing, so a re-run — or a run after `db:push` — is a no-op. The backfill keeps
-- one report per (campaign, document); if two version-keyed rows collapse to the same document the new
-- unique fails loudly rather than silently dropping report data.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'country_reports' AND column_name = 'country_id'
	) THEN
		ALTER TABLE country_reports ADD COLUMN IF NOT EXISTS country_document_id uuid;

		UPDATE country_reports r
		SET country_document_id = ev.entity_id
		FROM entity_versions ev
		WHERE ev.id = r.country_id;

		ALTER TABLE country_reports DROP COLUMN country_id;

		ALTER TABLE country_reports
			ALTER COLUMN country_document_id SET NOT NULL;

		ALTER TABLE country_reports
			ADD CONSTRAINT country_reports_country_document_id_entities_id_fk
				FOREIGN KEY (country_document_id) REFERENCES entities (id),
			ADD CONSTRAINT country_reports_campaign_id_country_document_id_unique
				UNIQUE (campaign_id, country_document_id);
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'working_group_reports' AND column_name = 'working_group_id'
	) THEN
		ALTER TABLE working_group_reports ADD COLUMN IF NOT EXISTS working_group_document_id uuid;

		UPDATE working_group_reports r
		SET working_group_document_id = ev.entity_id
		FROM entity_versions ev
		WHERE ev.id = r.working_group_id;

		ALTER TABLE working_group_reports DROP COLUMN working_group_id;

		ALTER TABLE working_group_reports
			ALTER COLUMN working_group_document_id SET NOT NULL;

		ALTER TABLE working_group_reports
			ADD CONSTRAINT working_group_reports_wg_document_id_entities_id_fk
				FOREIGN KEY (working_group_document_id) REFERENCES entities (id),
			ADD CONSTRAINT working_group_reports_campaign_wg_document_unique
				UNIQUE (campaign_id, working_group_document_id);
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'country_report_institutions' AND column_name = 'organisational_unit_id'
	) THEN
		ALTER TABLE country_report_institutions ADD COLUMN IF NOT EXISTS organisational_unit_document_id uuid;

		UPDATE country_report_institutions r
		SET organisational_unit_document_id = ev.entity_id
		FROM entity_versions ev
		WHERE ev.id = r.organisational_unit_id;

		ALTER TABLE country_report_institutions DROP COLUMN organisational_unit_id;

		ALTER TABLE country_report_institutions
			ALTER COLUMN organisational_unit_document_id SET NOT NULL;

		ALTER TABLE country_report_institutions
			ADD CONSTRAINT country_report_institutions_unit_document_id_entities_id_fk
				FOREIGN KEY (organisational_unit_document_id) REFERENCES entities (id),
			ADD CONSTRAINT country_report_institutions_report_unit_document_unique
				UNIQUE (country_report_id, organisational_unit_document_id);
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'reporting_campaign_country_thresholds' AND column_name = 'country_id'
	) THEN
		ALTER TABLE reporting_campaign_country_thresholds ADD COLUMN IF NOT EXISTS country_document_id uuid;

		UPDATE reporting_campaign_country_thresholds r
		SET country_document_id = ev.entity_id
		FROM entity_versions ev
		WHERE ev.id = r.country_id;

		ALTER TABLE reporting_campaign_country_thresholds DROP COLUMN country_id;

		ALTER TABLE reporting_campaign_country_thresholds
			ALTER COLUMN country_document_id SET NOT NULL;

		ALTER TABLE reporting_campaign_country_thresholds
			ADD CONSTRAINT reporting_campaign_country_thresholds_country_doc_fk
				FOREIGN KEY (country_document_id) REFERENCES entities (id),
			ADD CONSTRAINT reporting_campaign_country_thresholds_campaign_country_doc_unique
				UNIQUE (campaign_id, country_document_id);
	END IF;
END $$;
