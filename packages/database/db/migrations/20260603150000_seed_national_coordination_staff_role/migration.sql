-- Widen the role-type enum CHECK to allow the new value. `db:push` normally keeps this in sync with
-- the schema, but deployment only runs `db:migrations:apply`, so it has to happen here.
ALTER TABLE "person_role_types" DROP CONSTRAINT IF EXISTS "person_role_types_type_enum_check";

--> statement-breakpoint
ALTER TABLE "person_role_types" ADD CONSTRAINT "person_role_types_type_enum_check" CHECK ("type" IN ('is_affiliated_with', 'is_chair_of', 'is_vice_chair_of', 'is_member_of', 'is_contact_for', 'national_coordinator', 'national_coordinator_deputy', 'national_coordination_staff', 'national_representative', 'national_representative_deputy'));

--> statement-breakpoint
INSERT INTO
	"person_role_types" ("type")
VALUES
	('national_coordination_staff')
ON CONFLICT ("type") DO NOTHING;

--> statement-breakpoint
INSERT INTO
	"person_role_types_to_organisational_unit_types" ("role_type_id", "unit_type_id")
SELECT
	"role_types"."id",
	"unit_types"."id"
FROM
	(
		VALUES
			('national_coordination_staff', 'country')
	) AS "tmp" ("role_type", "unit_type")
	JOIN "person_role_types" "role_types" ON "role_types"."type" = "tmp"."role_type"
	JOIN "organisational_unit_types" "unit_types" ON "unit_types"."type" = "tmp"."unit_type"
ON CONFLICT ("role_type_id", "unit_type_id") DO NOTHING;
