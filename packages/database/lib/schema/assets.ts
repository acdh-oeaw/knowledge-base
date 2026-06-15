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
	caption: p.text("caption"),
	alt: p.text("alt"),
	licenseId: p.uuid("license_id").references(() => licenses.id),
	...f.timestamps(),
});

export type Asset = typeof assets.$inferSelect;
export type AssetInput = typeof assets.$inferInsert;

export const AssetSelectSchema = createSelectSchema(assets);
export const AssetInsertSchema = createInsertSchema(assets);
export const AssetUpdateSchema = createUpdateSchema(assets);
