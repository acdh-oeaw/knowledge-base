CREATE TABLE "locales" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"language_code" text NOT NULL,
	"region_code" text,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"entity_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"locale_id" uuid NOT NULL,
	"old_value" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirects_type_locale_old_value_unique" UNIQUE("type_id","locale_id","old_value")
);
--> statement-breakpoint
CREATE TABLE "slugs" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"entity_version_id" uuid NOT NULL CONSTRAINT "slugs_entity_version_id_unique" UNIQUE,
	"entity_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"locale_id" uuid NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP VIEW "document_lifecycle";

--> statement-breakpoint
DROP VIEW "statistics";

ALTER TABLE "entities" DROP CONSTRAINT "entities_type_id_slug_unique";--> statement-breakpoint
ALTER TABLE "entity_versions" ADD COLUMN "locale_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "entity_versions" RENAME CONSTRAINT "entity_versions_entity_id_status_id_unique" TO "entity_versions_entity_id_status_id_locale_id_unique";--> statement-breakpoint
ALTER TABLE "entity_versions" DROP CONSTRAINT "entity_versions_entity_id_status_id_locale_id_unique";--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_entity_id_status_id_locale_id_unique" UNIQUE("entity_id","status_id","locale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_default_locale" ON "locales" ("is_default") WHERE "is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_language_region" ON "locales" ("language_code","region_code") WHERE "region_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_language_only" ON "locales" ("language_code") WHERE "region_code" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "slugs_published_type_locale_value_unique" ON "slugs" ("type_id","locale_id","value") WHERE "is_published";--> statement-breakpoint
ALTER TABLE "entity_versions" ADD CONSTRAINT "entity_versions_locale_id_locales_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id");--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_type_id_entity_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "entity_types"("id");--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_locale_id_locales_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id");--> statement-breakpoint
ALTER TABLE "slugs" ADD CONSTRAINT "slugs_entity_version_id_entity_versions_id_fkey" FOREIGN KEY ("entity_version_id") REFERENCES "entity_versions"("id");--> statement-breakpoint
ALTER TABLE "slugs" ADD CONSTRAINT "slugs_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "slugs" ADD CONSTRAINT "slugs_type_id_entity_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "entity_types"("id");--> statement-breakpoint
ALTER TABLE "slugs" ADD CONSTRAINT "slugs_locale_id_locales_id_fkey" FOREIGN KEY ("locale_id") REFERENCES "locales"("id");
