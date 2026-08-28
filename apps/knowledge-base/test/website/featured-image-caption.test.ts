import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { FeaturedImageInputSchema } from "@/lib/featured-image-input";

const FormSchema = v.object(FeaturedImageInputSchema);

const caption: JSONContent = {
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: "Photo: Jane Doe" }] }],
};

describe("featured image form input", () => {
	it("defaults to inheriting the asset caption", () => {
		expect(v.parse(FormSchema, { imageKey: "images/example.jpg" })).toStrictEqual({
			imageKey: "images/example.jpg",
			imageCaption: null,
			imageCaptionMode: "inherit",
		});
	});

	it("parses a custom caption posted as JSON", () => {
		expect(
			v.parse(FormSchema, {
				imageKey: "images/example.jpg",
				imageCaption: JSON.stringify(caption),
				imageCaptionMode: "override",
			}),
		).toStrictEqual({
			imageKey: "images/example.jpg",
			imageCaption: caption,
			imageCaptionMode: "override",
		});
	});

	it("keeps a written caption while the mode is not override, so toggling back does not lose it", () => {
		const parsed = v.parse(FormSchema, {
			imageKey: "images/example.jpg",
			imageCaption: JSON.stringify(caption),
			imageCaptionMode: "hidden",
		});

		expect(parsed.imageCaption).toStrictEqual(caption);
		expect(parsed.imageCaptionMode).toBe("hidden");
	});

	it("stores an empty editor document as no caption", () => {
		const empty: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

		expect(
			v.parse(FormSchema, {
				imageKey: "images/example.jpg",
				imageCaption: JSON.stringify(empty),
				imageCaptionMode: "override",
			}).imageCaption,
		).toBeNull();
	});

	it("rejects an unknown caption mode", () => {
		expect(() => {
			v.parse(FormSchema, { imageKey: "images/example.jpg", imageCaptionMode: "custom" });
		}).toThrow();
	});

	it("requires an image", () => {
		expect(() => {
			v.parse(FormSchema, { imageKey: "" });
		}).toThrow();
	});
});
