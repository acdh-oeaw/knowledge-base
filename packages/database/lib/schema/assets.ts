import type { JSONContent } from "@tiptap/core";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { licenses } from "./licenses";

export const assets = p.snakeCase.table("assets", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	key: p.text("key").notNull(),
	label: p.text("label").notNull(),
	filename: p.text("filename"),
	mimeType: p.text("mime_type").notNull(),
	/** File size in bytes. Nullable for assets uploaded before size tracking was added. */
	size: p.bigint("size", { mode: "number" }),
	/**
	 * Pixel dimensions of the stored image, as imgproxy renders it at native scale — EXIF orientation
	 * is already applied here, so a portrait photo off a phone reports portrait dimensions even
	 * though the pixel buffer is stored landscape.
	 *
	 * Consumers need these to build a truthful `srcset`. imgproxy does not enlarge, so a request for
	 * a width above the source's own silently returns the source size; a `srcset` that advertises
	 * candidates the source cannot deliver makes the browser pick the largest one, get fewer pixels
	 * than promised, and render it soft.
	 *
	 * Null for vector images, which have no raster resolution and no useful upper bound, and for
	 * assets uploaded before dimensions were tracked until `data:backfill:image-dimensions` has
	 * measured them.
	 */
	width: p.integer("width"),
	height: p.integer("height"),
	caption: p.jsonb("caption").$type<JSONContent>(),
	alt: p.text("alt"),
	licenseId: p.uuid("license_id").references(() => licenses.id),
	...f.timestamps(),
});

export type Asset = typeof assets.$inferSelect;
export type AssetInput = typeof assets.$inferInsert;

export const AssetSelectSchema = createSelectSchema(assets);
export const AssetInsertSchema = createInsertSchema(assets);
export const AssetUpdateSchema = createUpdateSchema(assets);
