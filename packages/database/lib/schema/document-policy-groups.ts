import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";

export const documentPolicyGroups = p.snakeCase.table("document_policy_groups", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	label: p.text("label").notNull().unique(),
	position: p.integer("position").notNull().default(0),
	...f.timestamps(),
});

export type DocumentPolicyGroup = typeof documentPolicyGroups.$inferSelect;
export type DocumentPolicyGroupInput = typeof documentPolicyGroups.$inferInsert;

export const DocumentPolicyGroupSelectSchema = createSelectSchema(documentPolicyGroups);
export const DocumentPolicyGroupInsertSchema = createInsertSchema(documentPolicyGroups);
export const DocumentPolicyGroupUpdateSchema = createUpdateSchema(documentPolicyGroups);
