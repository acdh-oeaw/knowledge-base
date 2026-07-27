import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { entities, entityTypes, entityVersions } from "./entities";
import { locales } from "./locales";

export const slugs = p.snakeCase.table(
	"slugs",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		entityVersionId: p
			.uuid("entity_version_id")
			.notNull()
			.references(() => entityVersions.id),
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		typeId: p
			.uuid("type_id")
			.notNull()
			.references(() => entityTypes.id),
		localeId: p
			.uuid("locale_id")
			.notNull()
			.references(() => locales.id),
		isPublished: p.boolean("is_published").notNull().default(false),
		value: p.text("value").notNull(),
		...f.timestamps(),
	},
	(t) => [
		p.unique("slugs_entity_version_id_unique").on(t.entityVersionId),
		p
			.uniqueIndex("slugs_published_type_locale_value_unique")
			.on(t.typeId, t.localeId, t.value)
			.where(sql`${t.isPublished}`),
	],
);

export type Slug = typeof slugs.$inferSelect;
export type SlugInput = typeof slugs.$inferInsert;
export const SlugSelectSchema = createSelectSchema(slugs);
export const SlugInsertSchema = createInsertSchema(slugs);
export const SlugUpdateSchema = createUpdateSchema(slugs);

export const slugRedirects = p.snakeCase.table(
	"slug_redirects",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		typeId: p
			.uuid("type_id")
			.notNull()
			.references(() => entityTypes.id),
		localeId: p
			.uuid("locale_id")
			.notNull()
			.references(() => locales.id),
		oldValue: p.text("old_value").notNull(),
		...f.timestamps(),
	},
	(t) => [
		p.unique("slug_redirects_type_locale_old_value_unique").on(t.typeId, t.localeId, t.oldValue),
	],
);

export type SlugRedirect = typeof slugRedirects.$inferSelect;
export type SlugRedirectInput = typeof slugRedirects.$inferInsert;
export const SlugRedirectSelectSchema = createSelectSchema(slugRedirects);
export const SlugRedirectInsertSchema = createInsertSchema(slugRedirects);
export const SlugRedirectUpdateSchema = createUpdateSchema(slugRedirects);
