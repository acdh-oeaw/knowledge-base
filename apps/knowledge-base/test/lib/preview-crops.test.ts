import { describe, expect, it } from "vitest";

import { getPreviewCrops } from "@/lib/focal-point";

describe("getPreviewCrops", () => {
	it("previews a photo at the range of shapes it is cropped to, never square", () => {
		const crops = getPreviewCrops("images/0192a0c0-photo.jpg");

		expect(crops?.map((crop) => crop.id)).toStrictEqual(["4:3", "16:9", "8:3"]);
	});

	it("previews a portrait square only", () => {
		expect(getPreviewCrops("avatars/0192a0c0-portrait.jpg")?.map((crop) => crop.id)).toStrictEqual([
			"1:1",
		]);
	});

	it("has nothing to preview for an asset that is never cropped", () => {
		expect(getPreviewCrops("logos/0192a0c0-mark.png")).toBe(null);
		expect(getPreviewCrops("documents/0192a0c0-report.pdf")).toBe(null);
	});
});
