import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { entityVersions } from "./entities";

export const opportunitySourcesEnum = ["dariah", "external"] as const;

export const opportunitySources = p.snakeCase.table(
	"opportunity_sources",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		source: p.text("source", { enum: opportunitySourcesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check("opportunity_sources_source_enum_check", inArray(t.source, opportunitySourcesEnum)),
	],
);

export type OpportunitySource = typeof opportunitySources.$inferSelect;
export type OpportunityProviderInput = typeof opportunitySources.$inferInsert;

export const OpportunitySourceSelectSchema = createSelectSchema(opportunitySources);
export const OpportunitySourceInsertSchema = createInsertSchema(opportunitySources);
export const OpportunitySourceUpdateSchema = createUpdateSchema(opportunitySources);

export const opportunities = p.snakeCase.table("opportunities", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => entityVersions.id),
	title: p.text("title").notNull(),
	summary: p.text("summary"),
	duration: f.timestampRange("duration").notNull(),
	sourceId: p
		.uuid("source_id")
		.notNull()
		.references(() => opportunitySources.id),
	website: p.text("website"),
	...f.timestamps(),
});

export type Opportunity = typeof opportunities.$inferSelect;
export type OpportunityInput = typeof opportunities.$inferInsert;

export const OpportunitySelectSchema = createSelectSchema(opportunities, {
	duration: f.TimestampRange,
});
export const OpportunityInsertSchema = createInsertSchema(opportunities, {
	duration: f.TimestampRange,
});
export const OpportunityUpdateSchema = createUpdateSchema(opportunities, {
	duration: f.TimestampRange,
});
