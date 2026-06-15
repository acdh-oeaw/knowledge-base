import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";

export const entityTypesEnum = [
	"documentation_pages",
	"documents_policies",
	"events",
	"external_links",
	"funding_calls",
	"impact_case_studies",
	"internal_pages",
	"news",
	"opportunities",
	"organisational_units",
	"pages",
	"persons",
	"projects",
	"spotlight_articles",
] as const;

export const entityTypes = p.snakeCase.table(
	"entity_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: entityTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("entity_types_type_enum_check", inArray(t.type, entityTypesEnum))],
);

export type EntityType = typeof entityTypes.$inferSelect;
export type EntityTypeInput = typeof entityTypes.$inferInsert;

export const EntityTypeSelectSchema = createSelectSchema(entityTypes);
export const EntityTypeInsertSchema = createInsertSchema(entityTypes);
export const EntityTypeUpdateSchema = createUpdateSchema(entityTypes);

export const entityStatusEnum = ["draft", "published"] as const;

export const entityStatus = p.snakeCase.table(
	"entity_status",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: entityStatusEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("entity_status_type_enum_check", inArray(t.type, entityStatusEnum))],
);

export type EntityStatus = typeof entityStatus.$inferSelect;
export type EntityStatusInput = typeof entityStatus.$inferInsert;

export const EntityStatusSelectSchema = createSelectSchema(entityStatus);
export const EntityStatusInsertSchema = createInsertSchema(entityStatus);
export const EntityStatusUpdateSchema = createUpdateSchema(entityStatus);

/**
 * A document is the stable identity of a piece of content across draft/published versions. Slug,
 * type, and cross-type relations live here so they survive republishes.
 */
export const entities = p.snakeCase.table(
	"entities",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		typeId: p
			.uuid("type_id")
			.notNull()
			.references(() => entityTypes.id),
		slug: p.text("slug").notNull(),
		...f.timestamps(),
	},
	(t) => [p.unique("entities_type_id_slug_unique").on(t.typeId, t.slug)],
);

export type Entity = typeof entities.$inferSelect;
export type EntityInput = typeof entities.$inferInsert;

export const EntitySelectSchema = createSelectSchema(entities);
export const EntityInsertSchema = createInsertSchema(entities);
export const EntityUpdateSchema = createUpdateSchema(entities);

/**
 * A version row holds the editable/publishable payload for a document at a given lifecycle status.
 * Subtype tables (news, events, ...), fields, and content blocks all key off `entityVersions.id`.
 */
export const entityVersions = p.snakeCase.table(
	"entity_versions",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		statusId: p
			.uuid("status_id")
			.notNull()
			.references(() => entityStatus.id),
		...f.timestamps(),
	},
	(t) => [p.unique("entity_versions_entity_id_status_id_unique").on(t.entityId, t.statusId)],
);

export type EntityVersion = typeof entityVersions.$inferSelect;
export type EntityVersionInput = typeof entityVersions.$inferInsert;

export const EntityVersionSelectSchema = createSelectSchema(entityVersions);
export const EntityVersionInsertSchema = createInsertSchema(entityVersions);
export const EntityVersionUpdateSchema = createUpdateSchema(entityVersions);

export const documentLifecycleStateEnum = ["draft", "published", "published_with_changes"] as const;
export type DocumentLifecycleStateValue = (typeof documentLifecycleStateEnum)[number];

// Per-document lifecycle snapshot. Backed by the view defined in
// db/migrations/20260524100000_add_document_lifecycle_view/migration.sql — keep
// the SQL CASE arms aligned with `documentLifecycleStateEnum` above.
export const documentLifecycle = p.snakeCase
	.view("document_lifecycle", {
		documentId: p.uuid("document_id").notNull(),
		typeId: p.uuid("type_id").notNull(),
		draftId: p.uuid("draft_id"),
		draftUpdatedAt: f.timestamp("draft_updated_at"),
		publishedId: p.uuid("published_id"),
		publishedUpdatedAt: f.timestamp("published_updated_at"),
		hasDraftChanges: p.boolean("has_draft_changes").notNull(),
		state: p
			.text("state", { enum: documentLifecycleStateEnum })
			.notNull()
			.$type<DocumentLifecycleStateValue>(),
	})
	.existing();

export type DocumentLifecycleRow = typeof documentLifecycle.$inferSelect;

export const entityTypesFieldsNames = p.snakeCase.table(
	"entity_types_fields_names",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		entityTypeId: p
			.uuid("entity_type_id")
			.notNull()
			.references(() => entityTypes.id),
		fieldName: p.text("field_name").notNull(),
	},
	(t) => [
		p
			.unique("entity_types_fields_names_entity_type_id_field_name_unique")
			.on(t.entityTypeId, t.fieldName),
	],
);

// only provide select for now: the entity type fields mapping should be changed via migrations
export type EntityTypesFieldsNames = typeof entityTypesFieldsNames.$inferSelect;

export const entityTypesFieldsNamesSelectSchema = createSelectSchema(entityTypesFieldsNames);

export const fields = p.snakeCase.table(
	"fields",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		entityVersionId: p
			.uuid("entity_version_id")
			.notNull()
			.references(() => entityVersions.id),
		fieldNameId: p
			.uuid("field_name_id")
			.notNull()
			.references(() => entityTypesFieldsNames.id),
		...f.timestamps(),
	},
	(t) => [
		p.unique("fields_entity_version_id_field_name_id_unique").on(t.entityVersionId, t.fieldNameId),
	],
);

export type Field = typeof fields.$inferSelect;
export type FieldInput = typeof fields.$inferInsert;

export const FieldSelectSchema = createSelectSchema(fields);
export const FieldInsertSchema = createInsertSchema(fields);
export const FieldUpdateSchema = createUpdateSchema(fields);

/**
 * Document-level: a relation between two documents, stable across versions. Public reads resolve
 * through the related document's published version.
 */
export const entitiesToEntities = p.snakeCase.table(
	"entities_to_entities",
	{
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		relatedEntityId: p
			.uuid("related_entity_id")
			.notNull()
			.references(() => entities.id),
		...f.timestamps(),
	},
	(t) => [
		p.primaryKey({
			columns: [t.entityId, t.relatedEntityId],
			name: "entities_to_entities_pkey",
		}),
	],
);

/** Document-level: a relation from a document to an external resource (search index id). */
export const entitiesToResources = p.snakeCase.table(
	"entities_to_resources",
	{
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		resourceId: p.text("resource_id").notNull(),
		...f.timestamps(),
	},
	(t) => [
		p.primaryKey({
			columns: [t.entityId, t.resourceId],
			name: "entities_to_resources_pkey",
		}),
	],
);
