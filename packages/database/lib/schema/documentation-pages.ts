import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { entityVersions } from "./entities";

export const documentationPages = p.snakeCase.table("documentation_pages", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	...f.timestamps(),
});

export type DocumentationPage = typeof documentationPages.$inferSelect;
export type DocumentationPageInput = typeof documentationPages.$inferInsert;

export const DocumentationPageSelectSchema = createSelectSchema(documentationPages);
export const DocumentationPageInsertSchema = createInsertSchema(documentationPages);
export const DocumentationPageUpdateSchema = createUpdateSchema(documentationPages);
