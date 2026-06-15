import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { assets } from "./assets";
import { documentPolicyGroups } from "./document-policy-groups";
import { entityVersions } from "./entities";

export const documentsPolicies = p.snakeCase.table("documents_policies", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	summary: p.text("summary"),
	url: p.text("url"),
	documentId: p
		.uuid("document_id")
		.notNull()
		.references(() => assets.id),
	groupId: p.uuid("group_id").references(() => documentPolicyGroups.id),
	position: p.integer("position").notNull().default(0),
	...f.timestamps(),
});

export type DocumentOrPolicy = typeof documentsPolicies.$inferSelect;
export type DocumentOrPolicyInput = typeof documentsPolicies.$inferInsert;

export const DocumentOrPolicySelectSchema = createSelectSchema(documentsPolicies);
export const DocumentOrPolicyInsertSchema = createInsertSchema(documentsPolicies);
export const DocumentOrPolicyUpdateSchema = createUpdateSchema(documentsPolicies);
