CREATE TABLE "site_metadata_translations" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"locale_id" uuid NOT NULL UNIQUE,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"og_title" text,
	"og_description" text,
	"og_image_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_metadata" DROP CONSTRAINT "site_metadata_og_image_id_assets_id_fkey";--> statement-breakpoint
ALTER TABLE "site_metadata" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "site_metadata" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "site_metadata" DROP COLUMN "og_title";--> statement-breakpoint
ALTER TABLE "site_metadata" DROP COLUMN "og_description";--> statement-breakpoint
ALTER TABLE "site_metadata" DROP COLUMN "og_image_id";--> statement-breakpoint
ALTER TABLE "site_metadata_translations" ADD CONSTRAINT "site_metadata_translations_locale_id_locales_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id");--> statement-breakpoint
ALTER TABLE "site_metadata_translations" ADD CONSTRAINT "site_metadata_translations_og_image_id_assets_id_fkey" FOREIGN KEY ("og_image_id") REFERENCES "assets"("id");