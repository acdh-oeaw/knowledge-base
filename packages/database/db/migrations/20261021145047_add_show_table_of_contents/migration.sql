ALTER TABLE "funding_calls" ADD COLUMN "show_table_of_contents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "impact_case_studies" ADD COLUMN "show_table_of_contents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "show_table_of_contents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "show_table_of_contents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "spotlight_articles" ADD COLUMN "show_table_of_contents" boolean DEFAULT false NOT NULL;