-- Move article contributor relations (impact case studies / spotlight articles → persons) from
-- version-id keys to document-id keys, mirroring the persons/projects/units migrations. Contributors
-- become document-level (one row per logical relation, never cloned per version) and are resolved to
-- the published/draft version at read time.
--
-- Idempotent: guarded on the old `*_id` columns still existing, so a re-run — or a run after
-- `db:push` has already produced the new shape — is a no-op.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'impact_case_studies_to_persons'
			AND column_name = 'impact_case_study_id'
	) THEN
		ALTER TABLE impact_case_studies_to_persons
			ADD COLUMN IF NOT EXISTS impact_case_study_document_id uuid,
			ADD COLUMN IF NOT EXISTS person_document_id uuid;

		UPDATE impact_case_studies_to_persons t
		SET impact_case_study_document_id = sev.entity_id
		FROM entity_versions sev
		WHERE sev.id = t.impact_case_study_id;

		UPDATE impact_case_studies_to_persons t
		SET person_document_id = pev.entity_id
		FROM entity_versions pev
		WHERE pev.id = t.person_id;

		-- Collapse the lifecycle clone cross-product to one row per (case study document, person
		-- document), preferring the row whose endpoints are both the published version.
		DROP TABLE IF EXISTS ics2p_dedup;
		CREATE TEMP TABLE ics2p_dedup ON COMMIT DROP AS
		SELECT t.ctid AS cid, row_number() OVER w AS rn
		FROM impact_case_studies_to_persons t
		JOIN entity_versions sev ON sev.id = t.impact_case_study_id
		JOIN entity_status sst ON sst.id = sev.status_id
		JOIN entity_versions pev ON pev.id = t.person_id
		JOIN entity_status pst ON pst.id = pev.status_id
		WINDOW w AS (
			PARTITION BY t.impact_case_study_document_id, t.person_document_id
			ORDER BY
				(CASE WHEN sst.type = 'published' AND pst.type = 'published' THEN 0 ELSE 1 END),
				t.ctid
		);

		DELETE FROM impact_case_studies_to_persons t
		USING ics2p_dedup d
		WHERE t.ctid = d.cid AND d.rn > 1;

		DROP TABLE ics2p_dedup;

		-- Swap the primary key and columns: dropping a column drops its single-column FK automatically.
		ALTER TABLE impact_case_studies_to_persons
			DROP CONSTRAINT impact_case_studies_to_persons_pkey;

		ALTER TABLE impact_case_studies_to_persons
			DROP COLUMN impact_case_study_id,
			DROP COLUMN person_id;

		ALTER TABLE impact_case_studies_to_persons
			ALTER COLUMN impact_case_study_document_id SET NOT NULL,
			ALTER COLUMN person_document_id SET NOT NULL;

		ALTER TABLE impact_case_studies_to_persons
			ADD CONSTRAINT impact_case_studies_to_persons_study_doc_fk
				FOREIGN KEY (impact_case_study_document_id) REFERENCES entities (id),
			ADD CONSTRAINT impact_case_studies_to_persons_person_doc_fk
				FOREIGN KEY (person_document_id) REFERENCES entities (id),
			ADD CONSTRAINT impact_case_studies_to_persons_pkey
				PRIMARY KEY (impact_case_study_document_id, person_document_id);
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'spotlight_articles_to_persons'
			AND column_name = 'spotlight_article_id'
	) THEN
		ALTER TABLE spotlight_articles_to_persons
			ADD COLUMN IF NOT EXISTS spotlight_article_document_id uuid,
			ADD COLUMN IF NOT EXISTS person_document_id uuid;

		UPDATE spotlight_articles_to_persons t
		SET spotlight_article_document_id = sev.entity_id
		FROM entity_versions sev
		WHERE sev.id = t.spotlight_article_id;

		UPDATE spotlight_articles_to_persons t
		SET person_document_id = pev.entity_id
		FROM entity_versions pev
		WHERE pev.id = t.person_id;

		-- Collapse the lifecycle clone cross-product to one row per (article document, person
		-- document), preferring the row whose endpoints are both the published version.
		DROP TABLE IF EXISTS sa2p_dedup;
		CREATE TEMP TABLE sa2p_dedup ON COMMIT DROP AS
		SELECT t.ctid AS cid, row_number() OVER w AS rn
		FROM spotlight_articles_to_persons t
		JOIN entity_versions sev ON sev.id = t.spotlight_article_id
		JOIN entity_status sst ON sst.id = sev.status_id
		JOIN entity_versions pev ON pev.id = t.person_id
		JOIN entity_status pst ON pst.id = pev.status_id
		WINDOW w AS (
			PARTITION BY t.spotlight_article_document_id, t.person_document_id
			ORDER BY
				(CASE WHEN sst.type = 'published' AND pst.type = 'published' THEN 0 ELSE 1 END),
				t.ctid
		);

		DELETE FROM spotlight_articles_to_persons t
		USING sa2p_dedup d
		WHERE t.ctid = d.cid AND d.rn > 1;

		DROP TABLE sa2p_dedup;

		-- Swap the primary key and columns: dropping a column drops its single-column FK automatically.
		ALTER TABLE spotlight_articles_to_persons
			DROP CONSTRAINT spotlight_articles_to_persons_pkey;

		ALTER TABLE spotlight_articles_to_persons
			DROP COLUMN spotlight_article_id,
			DROP COLUMN person_id;

		ALTER TABLE spotlight_articles_to_persons
			ALTER COLUMN spotlight_article_document_id SET NOT NULL,
			ALTER COLUMN person_document_id SET NOT NULL;

		ALTER TABLE spotlight_articles_to_persons
			ADD CONSTRAINT spotlight_articles_to_persons_article_doc_fk
				FOREIGN KEY (spotlight_article_document_id) REFERENCES entities (id),
			ADD CONSTRAINT spotlight_articles_to_persons_person_doc_fk
				FOREIGN KEY (person_document_id) REFERENCES entities (id),
			ADD CONSTRAINT spotlight_articles_to_persons_pkey
				PRIMARY KEY (spotlight_article_document_id, person_document_id);
	END IF;
END $$;
