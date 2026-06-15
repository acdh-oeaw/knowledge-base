ALTER TABLE "country_report_institutions" ADD COLUMN IF NOT EXISTS "representation_type" text;
--> statement-breakpoint
ALTER TABLE "country_report_institutions" DROP CONSTRAINT IF EXISTS "country_report_institutions_representation_type_enum_check";
--> statement-breakpoint
ALTER TABLE "country_report_institutions" ADD CONSTRAINT "country_report_institutions_representation_type_enum_check" CHECK ("representation_type" in ('is_national_coordinating_institution_in', 'is_national_representative_institution_in', 'is_partner_institution_of'));
