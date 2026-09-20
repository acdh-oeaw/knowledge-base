-- A navigation item is an intentional public link. Deleting its target must not silently turn the
-- item into a label without a destination; an administrator must remove or replace the navigation
-- item first.

-- Our initial migration created this foreign key as `…_fkey` (upstream's is named `…_fk`). Drop
-- both, so the constraint ends up existing exactly once whichever name the database has.
ALTER TABLE "navigation_items"
	DROP CONSTRAINT IF EXISTS "navigation_items_entity_id_entities_id_fkey";

--> statement-breakpoint

ALTER TABLE "navigation_items"
	DROP CONSTRAINT IF EXISTS "navigation_items_entity_id_entities_id_fk";

--> statement-breakpoint

ALTER TABLE "navigation_items"
	ADD CONSTRAINT "navigation_items_entity_id_entities_id_fkey"
	FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT;
