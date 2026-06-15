import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";

export const licenses = p.snakeCase.table("licenses", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	code: p.text("code").notNull().unique(),
	name: p.text("name").notNull(),
	url: p.text("url").notNull(),
	...f.timestamps(),
});

export type License = typeof licenses.$inferSelect;
export type LicenseInput = typeof licenses.$inferInsert;

export const LicenseSelectSchema = createSelectSchema(licenses);
export const LicenseInsertSchema = createInsertSchema(licenses);
export const LicenseUpdateSchema = createUpdateSchema(licenses);
