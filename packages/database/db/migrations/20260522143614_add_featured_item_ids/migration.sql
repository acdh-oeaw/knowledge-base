ALTER TABLE "site_metadata"
ADD COLUMN IF NOT EXISTS "featured_item_ids" jsonb;
