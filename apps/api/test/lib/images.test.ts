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
			},
			1280,
		);

		expect(image).toMatchObject({
			mimeType: "image/svg+xml",
			width: null,
			height: null,
			aspectRatio: 16 / 9,
		});
	});
});
