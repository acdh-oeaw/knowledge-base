-- Move project↔organisational-unit relations (project partners) from version-id keys to document-id
-- keys, mirroring the persons_to_organisational_units migration. Partners become document-level
-- (one row per logical relation, never cloned per version) and are resolved to the published/draft
-- version at read time.
--
-- Idempotent: guarded on the old `project_id` column still existing, so a re-run — or a run after
-- `db:push` has already produced the new shape — is a no-op.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'projects_to_organisational_units'
			AND column_name = 'project_id'
	) THEN
		-- the dariah_projects view depends on the old columns; drop it and recreate it below.
		DROP VIEW IF EXISTS dariah_projects;

		ALTER TABLE projects_to_organisational_units
			ADD COLUMN IF NOT EXISTS project_document_id uuid,
			ADD COLUMN IF NOT EXISTS unit_document_id uuid;

		UPDATE projects_to_organisational_units p
		SET project_document_id = pev.entity_id
		FROM entity_versions pev
		WHERE pev.id = p.project_id;

		UPDATE projects_to_organisational_units p
		SET unit_document_id = uev.entity_id
		FROM entity_versions uev
		WHERE uev.id = p.unit_id;

		-- Keep one row per (project document, unit document, role), preferring the row whose project and
		-- unit are both the published version, then the lowest id. A project partnership is not
		-- temporal (a unit is a partner of a project in a role at most once), so the whole triple
		-- collapses regardless of duration.
		DROP TABLE IF EXISTS p2ou_dedup;
		CREATE TEMP TABLE p2ou_dedup ON COMMIT DROP AS
		SELECT
			p.id,
			row_number() OVER w AS rn
		FROM projects_to_organisational_units p
		JOIN entity_versions pev ON pev.id = p.project_id
		JOIN entity_status pst ON pst.id = pev.status_id
		JOIN entity_versions uev ON uev.id = p.unit_id
		JOIN entity_status ust ON ust.id = uev.status_id
		WINDOW w AS (
			PARTITION BY p.project_document_id, p.unit_document_id, p.role_id
			ORDER BY
				(CASE WHEN pst.type = 'published' AND ust.type = 'published' THEN 0 ELSE 1 END),
				p.id
		);

		DELETE FROM projects_to_organisational_units p
		USING p2ou_dedup d
		WHERE p.id = d.id AND d.rn > 1;

		DROP TABLE p2ou_dedup;

		ALTER TABLE projects_to_organisational_units
			DROP COLUMN project_id,
			DROP COLUMN unit_id;

		ALTER TABLE projects_to_organisational_units
			ALTER COLUMN project_document_id SET NOT NULL,
			ALTER COLUMN unit_document_id SET NOT NULL;

		ALTER TABLE projects_to_organisational_units
			ADD CONSTRAINT projects_to_organisational_units_project_document_id_entities_id_fk
				FOREIGN KEY (project_document_id) REFERENCES entities (id),
			ADD CONSTRAINT projects_to_organisational_units_unit_document_id_entities_id_fk
				FOREIGN KEY (unit_document_id) REFERENCES entities (id),
			ADD CONSTRAINT projects_to_organisational_units_project_role_unit_unique
				UNIQUE (project_document_id, role_id, unit_document_id);

		-- recreate the dariah_projects view against the document-id columns (resolving each endpoint
		-- through its entity version).
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
	END IF;
END $$;
