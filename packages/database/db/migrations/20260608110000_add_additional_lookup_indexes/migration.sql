CREATE INDEX IF NOT EXISTS "entity_versions_status_entity_idx"
	ON "entity_versions" ("status_id", "entity_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_to_entities_related_entity_idx"
	ON "entities_to_entities" ("related_entity_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_to_organisational_units_unit_role_idx"
	ON "projects_to_organisational_units" ("unit_document_id", "role_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_to_organisational_units_service_role_idx"
	ON "services_to_organisational_units" ("service_id", "role_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_to_organisational_units_unit_role_idx"
	ON "services_to_organisational_units" ("organisational_unit_document_id", "role_id");
