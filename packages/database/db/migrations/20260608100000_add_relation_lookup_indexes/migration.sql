CREATE INDEX IF NOT EXISTS "organisational_units_to_units_related_unit_status_idx"
	ON "organisational_units_to_units" ("related_unit_document_id", "status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organisational_units_to_units_unit_status_idx"
	ON "organisational_units_to_units" ("unit_document_id", "status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_to_organisational_units_unit_role_idx"
	ON "persons_to_organisational_units" ("organisational_unit_document_id", "role_type_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_to_organisational_units_person_role_idx"
	ON "persons_to_organisational_units" ("person_document_id", "role_type_id");
