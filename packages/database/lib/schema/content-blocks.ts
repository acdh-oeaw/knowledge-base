import type { JSONContent } from "@tiptap/core";
import { inArray } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/valibot";

import * as f from "../fields";
import { uuidv7 } from "../functions";
import { assets } from "./assets";
import { fields } from "./entities";
import { imageCaptionModeColumn, imageCaptionModesEnum } from "./image-captions";

export const contentBlockTypesEnum = [
	"accordion",
	"accordion_item",
	"callout",
	"data",
	"embed",
	"gallery",
	"hero",
	"image",
	"media_text",
	"rich_text",
] as const;

export type ContentBlockType = (typeof contentBlockTypesEnum)[number];

/**
 * The block types a container may hold, keyed by the container's own type. A block type absent from
 * this map is a leaf: it takes no children at all, which is every type that existed before blocks
 * became a tree.
 *
 * Two rules are encoded here, and both are about meaning rather than rendering. An `accordion`
 * holds nothing but its items — a panel is the only thing an accordion _is_ a list of. An item, and
 * a `callout`, hold flow content: the things that read as part of a passage. `hero` and `data` are
 * excluded because they are page furniture rather than prose, and a container may not hold another
 * container of its own kind (or any other), so an author cannot bury a callout three levels deep
 * where no renderer would give it room.
 *
 * Not a database constraint: a `CHECK` cannot see the parent's type from the child's row, and a
 * trigger enforcing it would fire on every content save for a rule the editor already makes
 * unreachable. The editor gates insertion, {@link isAllowedChildBlockType} gates the write path,
 * and `data:audit:content-block-nesting` reports anything that got in anyway — the same shape as
 * the allowed-relation vocabularies.
 */
export const allowedChildBlockTypes = {
	accordion: ["accordion_item"],
	accordion_item: ["embed", "gallery", "image", "media_text", "rich_text"],
	callout: ["embed", "gallery", "image", "media_text", "rich_text"],
} as const satisfies Partial<Record<ContentBlockType, ReadonlyArray<ContentBlockType>>>;

export type ContainerBlockType = keyof typeof allowedChildBlockTypes;

export function isContainerBlockType(type: string): type is ContainerBlockType {
	return type in allowedChildBlockTypes;
}

export function isAllowedChildBlockType(parentType: string, childType: string): boolean {
	if (!isContainerBlockType(parentType)) {
		return false;
	}

	return (allowedChildBlockTypes[parentType] as ReadonlyArray<string>).includes(childType);
}

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

export const contentBlocks = p.snakeCase.table(
	"content_blocks",
	{
		id: p.uuid("id").primaryKey().default(uuidv7()),
		fieldId: p
			.uuid("field_id")
			.notNull()
			.references(() => fields.id),
		typeId: p
			.uuid("type_id")
			.notNull()
			.references(() => contentBlockTypes.id),
		/**
		 * The container this block sits in, or `null` for a block at the top of its field.
		 *
		 * A nested block keeps its own `field_id` — the same one its container has — rather than
		 * deriving it through the parent. That is deliberate: every query that owns a version's content
		 * by field (the clone, the wipe, the merge, the API's one big join) keeps working on the whole
		 * tree without a recursive CTE, and only the reads that want _roots_ have to say so. The two
		 * columns cannot disagree, because a subtree is only ever written by the same call that writes
		 * its root.
		 */
		parentBlockId: p.uuid("parent_block_id").references((): p.AnyPgColumn => contentBlocks.id, {
			onDelete: "cascade",
		}),
		/** Sort order among the blocks sharing a parent — or among a field's roots, where none does. */
		position: p.integer("position").notNull(),
		...f.timestamps(),
	},
	(t) => [p.index("content_blocks_parent_block_id_idx").on(t.parentBlockId)],
);

export type ContentBlock = typeof contentBlocks.$inferSelect;
export type ContentBlockInput = typeof contentBlocks.$inferInsert;

export const ContentBlockSelectSchema = createSelectSchema(contentBlocks);
export const ContentBlockInsertSchema = createInsertSchema(contentBlocks);
export const ContentBlockUpdateSchema = createUpdateSchema(contentBlocks);

export const calloutIntentsEnum = ["neutral", "info", "warning", "danger", "success"] as const;

/**
 * The framing of a callout — its intent and its heading. The body is not here: it is the block's
 * children, so an image inside a callout is an `image` block with a real reference to its asset
 * rather than a key buried in a jsonb document. A callout carrying nothing but prose has exactly
 * one child, a `rich_text` block, which is what every callout written before the body moved out
 * became.
 */
export const calloutContentBlocks = p.snakeCase.table(
	"content_blocks_type_callout",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => contentBlocks.id, { onDelete: "cascade" }),
		intent: p.text("intent", { enum: calloutIntentsEnum }).notNull().default("info"),
		title: p.text("title"),
		...f.timestamps(),
	},
	(t) => [
		p.check("content_blocks_type_callout_intent_enum_check", inArray(t.intent, calloutIntentsEnum)),
	],
);

export type CalloutContentBlock = typeof calloutContentBlocks.$inferSelect;
export type CalloutContentBlockInput = typeof calloutContentBlocks.$inferInsert;

export const CalloutContentBlockSelectSchema = createSelectSchema(calloutContentBlocks);
export const CalloutContentBlockInsertSchema = createInsertSchema(calloutContentBlocks);
export const CalloutContentBlockUpdateSchema = createUpdateSchema(calloutContentBlocks);

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
	caption: p.jsonb("caption").$type<JSONContent>(),
	...f.timestamps(),
});

export type EmbedContentBlock = typeof embedContentBlocks.$inferSelect;
export type EmbedContentBlockInput = typeof embedContentBlocks.$inferInsert;

export const EmbedContentBlockSelectSchema = createSelectSchema(embedContentBlocks);
export const EmbedContentBlockInsertSchema = createInsertSchema(embedContentBlocks);
export const EmbedContentBlockUpdateSchema = createUpdateSchema(embedContentBlocks);

/**
 * How a gallery arranges its items. A column count is deliberately not modelled: the renderer picks
 * one from the item count and the viewport, so an author chooses an arrangement, not a geometry.
 */
export const galleryLayoutEnum = ["carousel", "grid"] as const;

export const galleryContentBlocks = p.snakeCase.table("content_blocks_type_gallery", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	layout: p.text("layout", { enum: galleryLayoutEnum }).notNull().default("grid"),
	/**
	 * A caption for the gallery as a whole — what the set of images shows — alongside the per-item
	 * captions that credit each one. No `caption_mode` here, unlike every image placement: the
	 * gallery is not a placement of any one asset, so there is nothing for it to inherit from.
	 */
	caption: p.jsonb("caption").$type<JSONContent>(),
	...f.timestamps(),
});

export type GalleryContentBlock = typeof galleryContentBlocks.$inferSelect;
export type GalleryContentBlockInput = typeof galleryContentBlocks.$inferInsert;

export const GalleryContentBlockSelectSchema = createSelectSchema(galleryContentBlocks);
export const GalleryContentBlockInsertSchema = createInsertSchema(galleryContentBlocks);
export const GalleryContentBlockUpdateSchema = createUpdateSchema(galleryContentBlocks);

export const galleryContentBlockItems = p.snakeCase.table(
	"content_blocks_type_gallery_items",
	{
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
		caption: p.jsonb("caption").$type<JSONContent>(),
		captionMode: imageCaptionModeColumn("caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"content_blocks_type_gallery_items_caption_mode_enum_check",
			inArray(t.captionMode, imageCaptionModesEnum),
		),
	],
);

export type GalleryContentBlockItem = typeof galleryContentBlockItems.$inferSelect;
export type GalleryContentBlockItemInput = typeof galleryContentBlockItems.$inferInsert;

export const GalleryContentBlockItemSelectSchema = createSelectSchema(galleryContentBlockItems);
export const GalleryContentBlockItemInsertSchema = createInsertSchema(galleryContentBlockItems);
export const GalleryContentBlockItemUpdateSchema = createUpdateSchema(galleryContentBlockItems);

/**
 * How an `image` block sits in the content column. A deliberately closed vocabulary — not free-form
 * width/alignment — so authors pick a named layout rather than arbitrary geometry:
 *
 * - `default`: content-column width (the historical behaviour, and the column default);
 * - `wide`/`full`: broken out wider than the text column / to the viewport edge;
 * - `float-start`/`float-end`: pulled to the inline-start/-end at a constrained width, with the
 *   following text wrapping around it (what WordPress `alignleft`/`alignright` expressed). This is
 *   presentational float; for an image _semantically bound_ to a passage of text, use `media_text`
 *   instead.
 *
 * Each names the _slot_ the block claims, never the size the image is drawn at: an image narrower
 * than its slot renders at its natural width, centred, and is never upscaled to fill. imgproxy does
 * not enlarge, so a stretched small source gains no detail and only renders soft — which is why
 * "centred" is an invariant of every layout here rather than a layout of its own. A renderer that
 * wants to cap explicitly rather than lean on `width: auto` gets the intrinsic width from the
 * asset's `width` (null for vectors, and for assets not yet backfilled).
 */
export const imageLayoutEnum = ["default", "wide", "full", "float-start", "float-end"] as const;

export const imageContentBlocks = p.snakeCase.table(
	"content_blocks_type_image",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => contentBlocks.id, { onDelete: "cascade" }),
		imageId: p
			.uuid("image_id")
			.notNull()
			.references(() => assets.id),
		caption: p.jsonb("caption").$type<JSONContent>(),
		captionMode: imageCaptionModeColumn("caption_mode"),
		layout: p.text("layout", { enum: imageLayoutEnum }).notNull().default("default"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"content_blocks_type_image_caption_mode_enum_check",
			inArray(t.captionMode, imageCaptionModesEnum),
		),
		p.check("content_blocks_type_image_layout_enum_check", inArray(t.layout, imageLayoutEnum)),
	],
);

export type ImageContentBlock = typeof imageContentBlocks.$inferSelect;
export type ImageContentBlockInput = typeof imageContentBlocks.$inferInsert;

export const ImageContentBlockSelectSchema = createSelectSchema(imageContentBlocks);
export const ImageContentBlockInsertSchema = createInsertSchema(imageContentBlocks);
export const ImageContentBlockUpdateSchema = createUpdateSchema(imageContentBlocks);

export const mediaTextSideEnum = ["start", "end"] as const;

/**
 * A small image _semantically bound_ to a passage of text — a working-group logo next to its blurb,
 * or a person's portrait next to their bio — kept together as one block so the pairing travels with
 * the content. Deliberately narrow: one fixed image size, and only inline-`start`/-`end` placement,
 * so authors can't reach for arbitrary free-form layout. Hand-authored, not a migration target:
 * WordPress `alignleft`/`alignright` floats are presentational and migrate to an `image` block's
 * `float-start`/`float-end` layout instead (see `imageLayoutEnum`).
 *
 * The bound text is not a substitute for a caption: a speaker's biography reads as prose, while the
 * photo credit belongs to the image. So `caption`/`captionMode` work exactly as on `image` blocks
 * (see `imageCaptionModesEnum`) — inherit the asset's caption, override it for this one placement,
 * or suppress it.
 */
export const mediaTextContentBlocks = p.snakeCase.table(
	"content_blocks_type_media_text",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => contentBlocks.id, { onDelete: "cascade" }),
		imageId: p
			.uuid("image_id")
			.notNull()
			.references(() => assets.id),
		side: p.text("side", { enum: mediaTextSideEnum }).notNull().default("start"),
		content: p.jsonb("content").$type<JSONContent>().notNull(),
		caption: p.jsonb("caption").$type<JSONContent>(),
		captionMode: imageCaptionModeColumn("caption_mode"),
		...f.timestamps(),
	},
	(t) => [
		p.check("content_blocks_type_media_text_side_enum_check", inArray(t.side, mediaTextSideEnum)),
		p.check(
			"content_blocks_type_media_text_caption_mode_enum_check",
			inArray(t.captionMode, imageCaptionModesEnum),
		),
	],
);

export type MediaTextContentBlock = typeof mediaTextContentBlocks.$inferSelect;
export type MediaTextContentBlockInput = typeof mediaTextContentBlocks.$inferInsert;

export const MediaTextContentBlockSelectSchema = createSelectSchema(mediaTextContentBlocks);
export const MediaTextContentBlockInsertSchema = createInsertSchema(mediaTextContentBlocks);
export const MediaTextContentBlockUpdateSchema = createUpdateSchema(mediaTextContentBlocks);

export const heroContentBlocks = p.snakeCase.table(
	"content_blocks_type_hero",
	{
		id: p
			.uuid("id")
			.primaryKey()
			.references(() => contentBlocks.id, { onDelete: "cascade" }),
		title: p.text("title").notNull(),
		eyebrow: p.text("eyebrow"),
		imageId: p.uuid("image_id").references(() => assets.id),
		caption: p.jsonb("caption").$type<JSONContent>(),
		captionMode: imageCaptionModeColumn("caption_mode"),
		ctas: p.jsonb("ctas"),
		...f.timestamps(),
	},
	(t) => [
		p.check(
			"content_blocks_type_hero_caption_mode_enum_check",
			inArray(t.captionMode, imageCaptionModesEnum),
		),
	],
);

export type HeroContentBlock = typeof heroContentBlocks.$inferSelect;
export type HeroContentBlockInput = typeof heroContentBlocks.$inferInsert;

export const HeroContentBlockSelectSchema = createSelectSchema(heroContentBlocks);
export const HeroContentBlockInsertSchema = createInsertSchema(heroContentBlocks);
export const HeroContentBlockUpdateSchema = createUpdateSchema(heroContentBlocks);

/**
 * An accordion holds no content of its own — its panels are its children, one `accordion_item`
 * each, in `position` order. The row exists so the type-per-table shape every other block follows
 * holds here too, and so an accordion has somewhere to grow presentation options later.
 */
export const accordionContentBlocks = p.snakeCase.table("content_blocks_type_accordion", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	...f.timestamps(),
});

export type AccordionContentBlock = typeof accordionContentBlocks.$inferSelect;
export type AccordionContentBlockInput = typeof accordionContentBlocks.$inferInsert;

export const AccordionContentBlockSelectSchema = createSelectSchema(accordionContentBlocks);
export const AccordionContentBlockInsertSchema = createInsertSchema(accordionContentBlocks);
export const AccordionContentBlockUpdateSchema = createUpdateSchema(accordionContentBlocks);

/**
 * One panel of an accordion: a summary the reader clicks, and a body that is the item's own
 * children.
 *
 * A block type rather than a table hanging off the accordion (the way gallery items hang off their
 * gallery) precisely because a panel holds _blocks_. Making it a block means one parent column, one
 * recursion, and one set of rules for reading, writing, cloning and deleting a subtree — an item's
 * image is an `image` block exactly like an image anywhere else, instead of a second nesting
 * mechanism that every service would have to learn.
 *
 * Only legal beneath an `accordion`; see {@link allowedChildBlockTypes}.
 */
export const accordionItemContentBlocks = p.snakeCase.table("content_blocks_type_accordion_item", {
	id: p
		.uuid("id")
		.primaryKey()
		.references(() => contentBlocks.id, { onDelete: "cascade" }),
	title: p.text("title").notNull(),
	...f.timestamps(),
});

export type AccordionItemContentBlock = typeof accordionItemContentBlocks.$inferSelect;
export type AccordionItemContentBlockInput = typeof accordionItemContentBlocks.$inferInsert;

export const AccordionItemContentBlockSelectSchema = createSelectSchema(accordionItemContentBlocks);
export const AccordionItemContentBlockInsertSchema = createInsertSchema(accordionItemContentBlocks);
export const AccordionItemContentBlockUpdateSchema = createUpdateSchema(accordionItemContentBlocks);

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
