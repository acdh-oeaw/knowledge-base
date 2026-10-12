import { describe, expect, it } from "vitest";

import { getImageOptions } from "@/routes/assets/image-options";

describe("getImageOptions", () => {
	it("crops around the centre when the asset has no focal point", () => {
		expect(getImageOptions({ width: 1280, ar: "16x9", focalPoint: null })).toMatchObject({
			resizing_type: "fill",
			gravity: { type: "ce" },
		});
	});

	it("crops around the focal point", () => {
		expect(
			getImageOptions({ width: 1280, ar: "16x9", focalPoint: { x: 0.29, y: 0.43 } }),
		).toMatchObject({
			gravity: { type: "fp", x: 0.29, y: 0.43 },
		});
	});

	it("ignores a focal point without a crop", () => {
		expect(getImageOptions({ width: 1280, focalPoint: { x: 0.2, y: 0.2 } })).toStrictEqual({
			width: 1280,
		});
	});
});
