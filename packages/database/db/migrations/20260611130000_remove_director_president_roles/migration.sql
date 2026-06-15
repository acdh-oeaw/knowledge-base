-- Retire the `is_director_of` / `is_president_of` person role types. Governance bodies now use a
-- single vocabulary (`is_chair_of` / `is_member_of`); a board president is surfaced as such in the
-- UI for that specific body. Existing relations are re-mapped president -> chair and director ->
-- member so no membership data is lost, then the roles, their allow-list tuples and the enum CHECK
-- value are removed. Idempotent: re-runs find no rows to convert/delete.

-- Guard against the (person, org, role, duration) exclusion constraint: if a person already holds the
-- target role at the same org over an overlapping period, drop the now-redundant source relation
-- instead of letting the conversion below violate the constraint.
DELETE FROM persons_to_organisational_units src
USING
	persons_to_organisational_units dst,
	person_role_types src_role,
	person_role_types dst_role
WHERE src.role_type_id = src_role.id
	AND dst.role_type_id = dst_role.id
	AND src.person_document_id = dst.person_document_id
	AND src.organisational_unit_document_id = dst.organisational_unit_document_id
	AND src.duration && dst.duration
	AND (
		(src_role.type = 'is_president_of' AND dst_role.type = 'is_chair_of')
		OR (src_role.type = 'is_director_of' AND dst_role.type = 'is_member_of')
	);

--> statement-breakpoint
UPDATE persons_to_organisational_units
SET role_type_id = (SELECT id FROM person_role_types WHERE type = 'is_chair_of')
WHERE role_type_id = (SELECT id FROM person_role_types WHERE type = 'is_president_of');

--> statement-breakpoint
UPDATE persons_to_organisational_units
SET role_type_id = (SELECT id FROM person_role_types WHERE type = 'is_member_of')
WHERE role_type_id = (SELECT id FROM person_role_types WHERE type = 'is_director_of');

--> statement-breakpoint
DELETE FROM person_role_types_to_organisational_unit_types
WHERE role_type_id IN (
	SELECT id FROM person_role_types WHERE type IN ('is_director_of', 'is_president_of')
);

--> statement-breakpoint
DELETE FROM person_role_types
WHERE type IN ('is_director_of', 'is_president_of');

--> statement-breakpoint
-- Narrow the enum CHECK to match the schema. `db:push` keeps this in sync in development, but
-- deployment only runs `db:migrations:apply`, so it has to happen here.
ALTER TABLE "person_role_types" DROP CONSTRAINT IF EXISTS "person_role_types_type_enum_check";

--> statement-breakpoint
ALTER TABLE "person_role_types" ADD CONSTRAINT "person_role_types_type_enum_check" CHECK ("type" IN ('is_affiliated_with', 'is_chair_of', 'is_vice_chair_of', 'is_member_of', 'is_contact_for', 'national_coordinator', 'national_coordinator_deputy', 'national_coordination_staff', 'national_representative', 'national_representative_deputy'));
