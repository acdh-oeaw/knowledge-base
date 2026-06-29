CREATE TABLE "projects_to_persons" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"project_document_id" uuid NOT NULL,
	"unit_document_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"duration" tstzrange
);
--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_project_document_id_entities_id_fkey" FOREIGN KEY ("project_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_unit_document_id_entities_id_fkey" FOREIGN KEY ("unit_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_role_id_project_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "project_roles"("id");