CREATE TABLE "projects_to_assets" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"project_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects_to_assets" ADD CONSTRAINT "projects_to_assets_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id");--> statement-breakpoint
ALTER TABLE "projects_to_assets" ADD CONSTRAINT "projects_to_assets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");