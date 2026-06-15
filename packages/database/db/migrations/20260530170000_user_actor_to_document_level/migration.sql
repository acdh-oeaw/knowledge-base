-- Move a user's actor (person or country) from version-id keys to document-id keys. `users.person_id`
-- and `users.organisational_unit_id` referenced entity *version* ids; they now reference `entities.id`
-- (document ids) so the link stays valid across the actor's draft/publish lifecycle. The XOR check
-- constraint that spans both columns is dropped and recreated against the new columns.
--
-- Idempotent: guarded on the old `person_id` column still existing, so a re-run — or a run after
-- `db:push` has already produced the new shape — is a no-op.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'users'
			AND column_name = 'person_id'
	) THEN
		ALTER TABLE users
			ADD COLUMN IF NOT EXISTS person_document_id uuid,
			ADD COLUMN IF NOT EXISTS organisational_unit_document_id uuid;

		UPDATE users u
		SET person_document_id = pev.entity_id
		FROM entity_versions pev
		WHERE pev.id = u.person_id;

		UPDATE users u
		SET organisational_unit_document_id = oev.entity_id
		FROM entity_versions oev
		WHERE oev.id = u.organisational_unit_id;

		-- The XOR check spans both actor columns; drop it before dropping the old columns.
		ALTER TABLE users
			DROP CONSTRAINT IF EXISTS users_actor_xor_check;

		-- Swap the columns: dropping a column drops its single-column FK automatically.
		ALTER TABLE users
			DROP COLUMN person_id,
			DROP COLUMN organisational_unit_id;

		ALTER TABLE users
			ADD CONSTRAINT users_person_document_id_entities_id_fk
				FOREIGN KEY (person_document_id) REFERENCES entities (id),
			ADD CONSTRAINT users_organisational_unit_document_id_entities_id_fk
				FOREIGN KEY (organisational_unit_document_id) REFERENCES entities (id);

		ALTER TABLE users
			ADD CONSTRAINT users_actor_xor_check
				CHECK (
					NOT (
						person_document_id IS NOT NULL
						AND organisational_unit_document_id IS NOT NULL
					)
				);
	END IF;
END $$;
