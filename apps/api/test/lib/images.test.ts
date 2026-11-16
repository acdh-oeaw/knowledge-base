import { describe, expect, it } from "vitest";

import { generateImageUrl } from "@/lib/images";

describe("generateImageUrl", () => {
	it("includes mime type and intrinsic aspect ratio in an API image", () => {
		const image = generateImageUrl(
			{
				key: "images/0199a1d4-6158-7e99-94e9-7c31da2127c7",
				alt: null,
				caption: null,
				license: null,
				mimeType: "image/svg+xml",
				width: null,
				height: null,
				aspectRatio: 16 / 9,
				focalPointX: null,
				focalPointY: null,
			},
			1280,
		);

		expect(image).toMatchObject({
			mimeType: "image/svg+xml",
			width: null,
			height: null,
			aspectRatio: 16 / 9,
			focalPoint: null,
		});
	});

	it("serves the focal point as one object", () => {
		const image = generateImageUrl(
			{
				key: "images/0199a1d4-6158-7e99-94e9-7c31da2127c7",
				alt: null,
				caption: null,
				license: null,
				mimeType: "image/jpeg",
				width: 2048,
				height: 1377,
				focalPointX: 0.25,
				focalPointY: 0.4,
			},
			1280,
		);

		expect(image.focalPoint).toEqual({ x: 0.25, y: 0.4 });
	});
});
