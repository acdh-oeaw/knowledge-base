CREATE TABLE "projects_to_persons" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"project_document_id" uuid NOT NULL,
	"person_document_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"duration" tstzrange,
	CONSTRAINT "projects_to_persons_project_role_person_unique" UNIQUE("project_document_id","role_id","person_document_id")
);
--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_project_document_id_entities_id_fkey" FOREIGN KEY ("project_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_person_document_id_entities_id_fkey" FOREIGN KEY ("person_document_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "projects_to_persons" ADD CONSTRAINT "projects_to_persons_role_id_project_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "project_roles"("id");