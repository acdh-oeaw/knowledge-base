-- Record a SHA-256 digest of each asset's stored bytes, so binary-identical uploads can be found
-- with a single grouped query instead of downloading and hashing every object in storage.
--
-- Nullable: existing rows stay null until `data:backfill:asset-content-hashes` has hashed the
-- stored objects.
ALTER TABLE "assets"
	ADD COLUMN IF NOT EXISTS "content_hash" text;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assets_content_hash_idx"
	ON "assets" ("content_hash");
