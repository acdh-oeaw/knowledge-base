import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";

export const ContentBlockInputSchema = v.union([
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
				caption: v.optional(v.string()),
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
				caption: v.optional(v.string()),
			}),
		),
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
		type: v.literal("gallery"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				layout: v.optional(v.picklist(["carousel", "grid"] as const)),
				items: v.optional(
					v.array(
						v.object({
							imageKey: v.optional(v.string()),
							imageUrl: v.optional(v.string()),
							caption: v.optional(v.string()),
						}),
					),
				),
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
				ctas: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
			}),
		),
	}),
	v.object({
		id: v.string(),
		type: v.literal("accordion"),
		position: v.optional(v.number()),
		content: v.optional(
			v.object({
				items: v.optional(
					v.array(
						v.object({
							title: v.string(),
							content: v.optional(v.any()),
						}),
					),
				),
			}),
		),
	}),
]);

export type ContentBlockInput = v.InferOutput<typeof ContentBlockInputSchema>;
