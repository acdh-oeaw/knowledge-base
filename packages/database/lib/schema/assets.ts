import type { JSONContent } from "@tiptap/core";
import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { licenses } from "./licenses";

export const assets = p.snakeCase.table(
	"assets",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		key: p.text("key").notNull(),
		label: p.text("label").notNull(),
		filename: p.text("filename"),
		mimeType: p.text("mime_type").notNull(),
		/** File size in bytes. Nullable for assets uploaded before size tracking was added. */
		size: p.bigint("size", { mode: "number" }),
		/**
		 * Pixel dimensions of the stored image, as imgproxy renders it at native scale — EXIF
		 * orientation is already applied here, so a portrait photo off a phone reports portrait
		 * dimensions even though the pixel buffer is stored landscape.
		 *
		 * Consumers need these to build a truthful `srcset`. imgproxy does not enlarge, so a request
		 * for a width above the source's own silently returns the source size; a `srcset` that
		 * advertises candidates the source cannot deliver makes the browser pick the largest one, get
		 * fewer pixels than promised, and render it soft.
		 *
		 * Null for vector images, which have no raster resolution and no useful upper bound, and for
		 * assets uploaded before dimensions were tracked until `data:backfill:image-dimensions` has
		 * measured them.
		 */
		width: p.integer("width"),
		height: p.integer("height"),
		/** Intrinsic width/height ratio for both raster and vector images. */
		aspectRatio: p.doublePrecision("aspect_ratio"),
		/**
		 * Hex-encoded SHA-256 digest of the stored object's bytes, so binary-identical uploads can be
		 * found with a grouped query instead of downloading every object. Null for assets uploaded
		 * before hashes were tracked until `data:backfill:asset-content-hashes` has hashed them.
		 */
		contentHash: p.text("content_hash"),
		/**
		 * The point of the image to keep in view when a placement crops it (CSS `object-fit: cover`, or
		 * an imgproxy `fill` rendition), as fractions of the source width and height from the top left:
		 * `0.5, 0.5` is the centre. Belongs to the asset rather than to a placement, like its alt text:
		 * what matters in a picture does not change with the page it is shown on.
		 *
		 * Both null when no point was chosen, which consumers treat as the centre.
		 */
		focalPointX: p.doublePrecision("focal_point_x"),
		focalPointY: p.doublePrecision("focal_point_y"),
		caption: p.jsonb("caption").$type<JSONContent>(),
		alt: p.text("alt"),
		licenseId: p.uuid("license_id").references(() => licenses.id),
		...f.timestamps(),
	},
	(t) => [
		p.index("assets_content_hash_idx").on(t.contentHash),
		/** The api's variant and download routes look assets up by storage key, not by id. */
		p.index("assets_key_idx").on(t.key),
		p.check(
			"assets_focal_point_check",
			sql`(${t.focalPointX} IS NULL AND ${t.focalPointY} IS NULL) OR (${t.focalPointX} IS NOT NULL AND ${t.focalPointY} IS NOT NULL AND ${t.focalPointX} BETWEEN 0 AND 1 AND ${t.focalPointY} BETWEEN 0 AND 1)`,
		),
	],
);

export type Asset = typeof assets.$inferSelect;
export type AssetInput = typeof assets.$inferInsert;

export const AssetSelectSchema = createSelectSchema(assets);
export const AssetInsertSchema = createInsertSchema(assets);
export const AssetUpdateSchema = createUpdateSchema(assets);
