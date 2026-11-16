-- Let editors choose the point of an image to keep in view when a placement crops it, as fractions
-- of the source width and height from the top left. Both null means no point was chosen, which
-- consumers treat as the centre - so existing assets crop exactly as before.
ALTER TABLE "assets"
	ADD COLUMN IF NOT EXISTS "focal_point_x" double precision,
	ADD COLUMN IF NOT EXISTS "focal_point_y" double precision;

--> statement-breakpoint

-- Dropped first so this migration also applies to a database that `db:push` has already brought in
-- line with the drizzle schema.
ALTER TABLE "assets"
	DROP CONSTRAINT IF EXISTS "assets_focal_point_check";

--> statement-breakpoint

ALTER TABLE "assets"
	ADD CONSTRAINT "assets_focal_point_check" CHECK (
		("focal_point_x" IS NULL AND "focal_point_y" IS NULL)
		OR (
			"focal_point_x" IS NOT NULL
			AND "focal_point_y" IS NOT NULL
			AND "focal_point_x" BETWEEN 0 AND 1
			AND "focal_point_y" BETWEEN 0 AND 1
		)
	);

--> statement-breakpoint

-- The api's image route now reads the focal point by storage key whenever it crops, so that lookup
-- runs on a hot path. The download route has always looked assets up the same way, unindexed.
CREATE INDEX IF NOT EXISTS "assets_key_idx"
	ON "assets" ("key");
