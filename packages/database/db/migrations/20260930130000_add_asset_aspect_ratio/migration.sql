-- Store an image's intrinsic ratio separately from its raster dimensions. SVG assets deliberately
-- keep width/height null because those columns bound raster renditions, but their viewBox still
-- provides a useful layout ratio.
ALTER TABLE "assets"
	ADD COLUMN IF NOT EXISTS "aspect_ratio" double precision;
