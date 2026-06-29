CREATE TABLE "persons_to_social_media" (
	"id" uuid PRIMARY KEY DEFAULT UUIDV7(),
	"person_id" uuid NOT NULL,
	"social_media_id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons_to_social_media" ADD CONSTRAINT "persons_to_social_media_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id");--> statement-breakpoint
ALTER TABLE "persons_to_social_media" ADD CONSTRAINT "persons_to_social_media_social_media_id_social_media_id_fkey" FOREIGN KEY ("social_media_id") REFERENCES "social_media"("id");