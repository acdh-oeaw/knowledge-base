import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";

const ImageCaptionModeSchema = v.picklist(["hidden", "inherit", "override"] as const);

/**
 * The blocks that may sit inside a container — a callout, or one panel of an accordion. Exactly the
 * `allowedChildBlockTypes` vocabulary in `@dariah-eric/database`, spelled out here as its own
 * schema so the nesting rules are enforced by parsing rather than by a check after the fact.
 *
 * Every one of these carries its own storage: an image inside a callout is an `image` block with a
 * real reference to its asset, which is the whole point of the tree.
 */
const NestableContentBlockInputSchema = v.union([
	v.object({
		id: v.string(),
		type: v.literal("rich_text"),
		position: v.optional(v.number()),
		content: v.optional(v.custom<JSONContent>(() => true)),
	}),
	v.object({
		id: v.string(),
		type: v.literal("image"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				imageKey: v.optional(v.string()),
				imageUrl: v.optional(v.string()),
				alt: v.optional(v.nullable(v.string())),
				assetCaption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				captionMode: v.optional(ImageCaptionModeSchema),
				layout: v.optional(
					v.picklist(["default", "wide", "full", "float-start", "float-end"] as const),
				),
			}),
		),
	}),
	v.object({
		id: v.string(),
		type: v.literal("embed"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				url: v.optional(v.string()),
				title: v.optional(v.string()),
				caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
			}),
		),
	}),
	v.object({
		id: v.string(),
		type: v.literal("gallery"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				layout: v.optional(v.picklist(["carousel", "grid"] as const)),
				caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				items: v.optional(
					v.array(
						v.object({
							imageKey: v.optional(v.string()),
							imageUrl: v.optional(v.string()),
							caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
							captionMode: v.optional(ImageCaptionModeSchema),
						}),
					),
				),
			}),
		),
	}),
	v.object({
		id: v.string(),
		type: v.literal("media_text"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				imageKey: v.optional(v.string()),
				imageUrl: v.optional(v.string()),
				alt: v.optional(v.nullable(v.string())),
				assetCaption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				captionMode: v.optional(ImageCaptionModeSchema),
				side: v.optional(v.picklist(["start", "end"] as const)),
				content: v.optional(v.custom<JSONContent>(() => true)),
			}),
		),
	}),
]);

export type NestableContentBlockInput = v.InferOutput<typeof NestableContentBlockInputSchema>;

/** One panel of an accordion: a summary, and a body made of blocks. Only legal under an accordion. */
const AccordionItemContentBlockInputSchema = v.object({
	id: v.string(),
	type: v.literal("accordion_item"),
	position: v.optional(v.number()),
	content: v.optional(v.object({ title: v.optional(v.string()) })),
	children: v.optional(v.array(NestableContentBlockInputSchema)),
});

export type AccordionItemContentBlockInput = v.InferOutput<
	typeof AccordionItemContentBlockInputSchema
>;

/**
 * A block as the dashboard submits it, with a container's body as its `children` rather than a
 * document buried in `content`.
 *
 * Deliberately two levels rather than an open recursion: a container may hold flow content, and an
 * accordion may hold panels, but no container holds another. That bound is what lets this stay a
 * plain inferrable union instead of a `v.lazy` cycle — and it is the same rule
 * `allowedChildBlockTypes` states for the write path and the audit script.
 */
export const ContentBlockInputSchema = v.union([
	NestableContentBlockInputSchema,
	AccordionItemContentBlockInputSchema,
	v.object({
		id: v.string(),
		type: v.literal("callout"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				intent: v.optional(
					v.picklist(["neutral", "info", "warning", "danger", "success"] as const),
				),
				title: v.optional(v.string()),
			}),
		),
		children: v.optional(v.array(NestableContentBlockInputSchema)),
	}),
	v.object({
		id: v.string(),
		type: v.literal("accordion"),
		position: v.optional(v.number()),
		children: v.optional(v.array(AccordionItemContentBlockInputSchema)),
	}),
	v.object({
		id: v.string(),
		type: v.literal("data"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				dataType: v.optional(
					v.picklist([
						"events",
						"news",
						"opportunities",
						"funding_calls",
						"pages",
						"spotlight_articles",
						"impact_case_studies",
					] as const),
				),
				limit: v.optional(v.number()),
				selectedIds: v.optional(v.array(v.string())),
			}),
		),
	}),
	v.object({
		id: v.string(),
		type: v.literal("hero"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				title: v.optional(v.string()),
				eyebrow: v.optional(v.string()),
				imageKey: v.optional(v.string()),
				imageUrl: v.optional(v.string()),
				caption: v.optional(v.nullable(v.custom<JSONContent>(() => true))),
				captionMode: v.optional(ImageCaptionModeSchema),
				ctas: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
			}),
		),
	}),
]);

export type ContentBlockInput = v.InferOutput<typeof ContentBlockInputSchema>;

/** The children a block submitted, or none — every container spells its body this way. */
export function getContentBlockInputChildren(block: ContentBlockInput): Array<ContentBlockInput> {
	return "children" in block ? (block.children ?? []) : [];
}
