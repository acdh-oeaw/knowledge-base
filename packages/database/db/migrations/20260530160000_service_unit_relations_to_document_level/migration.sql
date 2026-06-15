-- Move the organisational-unit endpoint of service↔unit relations from a version-id key to a
-- document-id key. Services are not versioned entities (their `id` is a standalone key), so
-- `service_id` is unchanged; only `organisational_unit_id` (a versioned entity) is re-keyed to
-- `entities.id` so the relation stays valid across the unit's draft/publish lifecycle.
--
-- Idempotent: guarded on the old `organisational_unit_id` column still existing, so a re-run — or a
-- run after `db:push` has already produced the new shape — is a no-op.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'services_to_organisational_units'
			AND column_name = 'organisational_unit_id'
	) THEN
		ALTER TABLE services_to_organisational_units
			ADD COLUMN IF NOT EXISTS organisational_unit_document_id uuid;

		UPDATE services_to_organisational_units r
		SET organisational_unit_document_id = uev.entity_id
		FROM entity_versions uev
		WHERE uev.id = r.organisational_unit_id;

		-- Swap the column: dropping a column drops its single-column FK automatically.
		ALTER TABLE services_to_organisational_units
			DROP COLUMN organisational_unit_id;

		ALTER TABLE services_to_organisational_units
			ALTER COLUMN organisational_unit_document_id SET NOT NULL;

		ALTER TABLE services_to_organisational_units
			ADD CONSTRAINT services_to_organisational_units_unit_doc_fk
				FOREIGN KEY (organisational_unit_document_id) REFERENCES entities (id);
	END IF;
END $$;
