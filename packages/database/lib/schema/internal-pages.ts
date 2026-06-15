import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { entityVersions } from "./entities";

export const internalPages = p.snakeCase.table("internal_pages", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	...f.timestamps(),
});

export type InternalPage = typeof internalPages.$inferSelect;
export type InternalPageInput = typeof internalPages.$inferInsert;

export const InternalPageSelectSchema = createSelectSchema(internalPages);
export const InternalPageInsertSchema = createInsertSchema(internalPages);
export const InternalPageUpdateSchema = createUpdateSchema(internalPages);
