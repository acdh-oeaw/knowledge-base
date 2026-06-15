import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { fields } from "./entities";

export const contentBlockTypesEnum = [
	"accordion",
	"data",
	"embed",
	"gallery",
	"hero",
	"image",
	"rich_text",
] as const;

export const contentBlockTypes = p.snakeCase.table(
	"content_blocks_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: contentBlockTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [p.check("content_blocks_types_type_enum_check", inArray(t.type, contentBlockTypesEnum))],
);

export type ContentBlockTypes = typeof contentBlockTypes.$inferSelect;
export type ContentBlockTypesInput = typeof contentBlockTypes.$inferInsert;

export const ContentBlockTypesSelectSchema = createSelectSchema(contentBlockTypes);
export const ContentBlockTypesInsertSchema = createInsertSchema(contentBlockTypes);
export const ContentBlockTypesUpdateSchema = createUpdateSchema(contentBlockTypes);

export const contentBlocks = p.snakeCase.table("content_blocks", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	fieldId: p
		.uuid("field_id")
		.notNull()
		.references(() => fields.id),
	typeId: p
		.uuid("type_id")
		.notNull()
		.references(() => contentBlockTypes.id),
	position: p.integer("position").notNull(),
	...f.timestamps(),
});

export type ContentBlock = typeof contentBlocks.$inferSelect;
export type ContentBlockInput = typeof contentBlocks.$inferInsert;

export const ContentBlockSelectSchema = createSelectSchema(contentBlocks);
export const ContentBlockInsertSchema = createInsertSchema(contentBlocks);
export const ContentBlockUpdateSchema = createUpdateSchema(contentBlocks);

export const dataContentBlockTypesEnum = [
	"events",
	"funding_calls",
	"impact_case_studies",
	"news",
	"opportunities",
	"pages",
	"spotlight_articles",
] as const;

export const dataContentBlockTypes = p.snakeCase.table(
	"content_blocks_type_data_types",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		type: p.text("type", { enum: dataContentBlockTypesEnum }).notNull().unique(),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"content_blocks_type_data_types_type_enum_check",
			inArray(t.type, dataContentBlockTypesEnum),
		),
	],
);

export type DataContentBlockTypes = typeof dataContentBlockTypes.$inferSelect;
export type DataContentBlockTypesInput = typeof dataContentBlockTypes.$inferInsert;

export const DataContentBlockTypesSelectSchema = createSelectSchema(dataContentBlockTypes);
export const DataContentBlockTypesInsertSchema = createInsertSchema(dataContentBlockTypes);
export const DataContentBlockTypesUpdateSchema = createUpdateSchema(dataContentBlockTypes);

export const dataContentBlocks = p.snakeCase.table("content_blocks_type_data", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	typeId: p
		.uuid("type_id")
		.notNull()
		.references(() => dataContentBlockTypes.id),
	limit: p.integer("limit"),
	selectedIds: p.jsonb("selected_ids"),
	...f.timestamps(),
});

export type DataContentBlock = typeof dataContentBlocks.$inferSelect;
export type DataContentBlockInput = typeof dataContentBlocks.$inferInsert;

export const DataContentBlockSelectSchema = createSelectSchema(dataContentBlocks);
export const DataContentBlockInsertSchema = createInsertSchema(dataContentBlocks);
export const DataContentBlockUpdateSchema = createUpdateSchema(dataContentBlocks);

export const embedContentBlocks = p.snakeCase.table("content_blocks_type_embed", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	url: p.text("url").notNull(),
	title: p.text("title").notNull(),
	caption: p.text("caption"),
	...f.timestamps(),
});

export type EmbedContentBlock = typeof embedContentBlocks.$inferSelect;
export type EmbedContentBlockInput = typeof embedContentBlocks.$inferInsert;

export const EmbedContentBlockSelectSchema = createSelectSchema(embedContentBlocks);
export const EmbedContentBlockInsertSchema = createInsertSchema(embedContentBlocks);
export const EmbedContentBlockUpdateSchema = createUpdateSchema(embedContentBlocks);

export const galleryContentBlocks = p.snakeCase.table("content_blocks_type_gallery", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	layout: p
		.text("layout", { enum: ["carousel", "grid"] })
		.notNull()
		.default("grid"),
	...f.timestamps(),
});

export type GalleryContentBlock = typeof galleryContentBlocks.$inferSelect;
export type GalleryContentBlockInput = typeof galleryContentBlocks.$inferInsert;

export const GalleryContentBlockSelectSchema = createSelectSchema(galleryContentBlocks);
export const GalleryContentBlockInsertSchema = createInsertSchema(galleryContentBlocks);
export const GalleryContentBlockUpdateSchema = createUpdateSchema(galleryContentBlocks);

export const galleryContentBlockItems = p.snakeCase.table("content_blocks_type_gallery_items", {
	id: p.uuid("id").primaryKey().default(uuidv7()),
	galleryContentBlockId: p
		.uuid("gallery_content_block_id")
		.notNull()
		.references(() => galleryContentBlocks.id, { onDelete: "cascade" }),
	imageId: p
		.uuid("image_id")
		.notNull()
		.references(() => assets.id),
	position: p.integer("position").notNull(),
	caption: p.text("caption"),
	...f.timestamps(),
});

export type GalleryContentBlockItem = typeof galleryContentBlockItems.$inferSelect;
export type GalleryContentBlockItemInput = typeof galleryContentBlockItems.$inferInsert;

export const GalleryContentBlockItemSelectSchema = createSelectSchema(galleryContentBlockItems);
export const GalleryContentBlockItemInsertSchema = createInsertSchema(galleryContentBlockItems);
export const GalleryContentBlockItemUpdateSchema = createUpdateSchema(galleryContentBlockItems);

export const imageContentBlocks = p.snakeCase.table("content_blocks_type_image", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	imageId: p
		.uuid("image_id")
		.notNull()
		.references(() => assets.id),
	caption: p.text("caption"),
	...f.timestamps(),
});

export type ImageContentBlock = typeof imageContentBlocks.$inferSelect;
export type ImageContentBlockInput = typeof imageContentBlocks.$inferInsert;

export const ImageContentBlockSelectSchema = createSelectSchema(imageContentBlocks);
export const ImageContentBlockInsertSchema = createInsertSchema(imageContentBlocks);
export const ImageContentBlockUpdateSchema = createUpdateSchema(imageContentBlocks);

export const heroContentBlocks = p.snakeCase.table("content_blocks_type_hero", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	title: p.text("title").notNull(),
	eyebrow: p.text("eyebrow"),
	imageId: p.uuid("image_id").references(() => assets.id),
	ctas: p.jsonb("ctas"),
	...f.timestamps(),
});

export type HeroContentBlock = typeof heroContentBlocks.$inferSelect;
export type HeroContentBlockInput = typeof heroContentBlocks.$inferInsert;

export const HeroContentBlockSelectSchema = createSelectSchema(heroContentBlocks);
export const HeroContentBlockInsertSchema = createInsertSchema(heroContentBlocks);
export const HeroContentBlockUpdateSchema = createUpdateSchema(heroContentBlocks);

export const accordionContentBlocks = p.snakeCase.table("content_blocks_type_accordion", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	items: p.jsonb("items").notNull(),
	...f.timestamps(),
});

export type AccordionContentBlock = typeof accordionContentBlocks.$inferSelect;
export type AccordionContentBlockInput = typeof accordionContentBlocks.$inferInsert;

export const AccordionContentBlockSelectSchema = createSelectSchema(accordionContentBlocks);
export const AccordionContentBlockInsertSchema = createInsertSchema(accordionContentBlocks);
export const AccordionContentBlockUpdateSchema = createUpdateSchema(accordionContentBlocks);

export const richTextContentBlocks = p.snakeCase.table("content_blocks_type_rich_text", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	content: p.jsonb("content").$type<JSONContent>().notNull(),
	...f.timestamps(),
});

export type RichTextContentBlock = typeof richTextContentBlocks.$inferSelect;
export type RichTextContentBlockInput = typeof richTextContentBlocks.$inferInsert;

export const RichTextContentBlockSelectSchema = createSelectSchema(richTextContentBlocks);
export const RichTextContentBlockInsertSchema = createInsertSchema(richTextContentBlocks);
export const RichTextContentBlockUpdateSchema = createUpdateSchema(richTextContentBlocks);
