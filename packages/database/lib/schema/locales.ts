import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";

export const locales = p.snakeCase.table(
	"locales",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		languageCode: p.text("language_code").notNull(),
		regionCode: p.text("region_code"),
		name: p.text("name").notNull(),
		isDefault: p.boolean("is_default").notNull().default(false),
		...f.timestamps(),
	},
	(t) => [
		p
			.uniqueIndex("one_default_locale")
			.on(t.isDefault)
			.where(sql`${t.isDefault} = true`),
		p
			.uniqueIndex("uq_language_region")
			.on(t.languageCode, t.regionCode)
			.where(sql`${t.regionCode} IS NOT NULL`),
		p
			.uniqueIndex("uq_language_only")
			.on(t.languageCode)
			.where(sql`${t.regionCode} IS NULL`),
	],
);

export type Locale = typeof locales.$inferSelect;
export type LocaleInput = typeof locales.$inferInsert;

export const LocaleSelectSchema = createSelectSchema(locales);
export const LocaleInsertSchema = createInsertSchema(locales);
export const LocaleUpdateSchema = createUpdateSchema(locales);
