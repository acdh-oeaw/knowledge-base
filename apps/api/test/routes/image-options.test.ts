import { describe, expect, it } from "vitest";

import { getImageOptions } from "@/routes/assets/image-options";

describe("getImageOptions", () => {
	it("crops around the centre when the asset has no focal point", () => {
		expect(getImageOptions({ width: 1280, ar: "16x9", focalPoint: null })).toMatchObject({
			resizing_type: "fill",
			gravity: { type: "ce" },
		});
	});

	it("places the crop like css `object-position` at the focal point", () => {
		/* A 2:1 image cut to 1:1 keeps half its width; `object-position: 29%` starts that half at
		   0.145, so imgproxy is asked to centre on 0.395. Nothing is cut vertically. */
		const options = getImageOptions({
			width: 1280,
			ar: "1x1",
			focalPoint: { x: 0.29, y: 0.43 },
			imageAspectRatio: 2,
		});

		expect(options.gravity).toMatchObject({ type: "fp" });
		expect(options.gravity).toHaveProperty("x", expect.closeTo(0.395));
		expect(options.gravity).toHaveProperty("y", expect.closeTo(0.5));
	});

	it("keeps a focal point at the edge at that edge", () => {
		const options = getImageOptions({
			width: 1280,
			ar: "1x1",
			focalPoint: { x: 1, y: 0.5 },
			imageAspectRatio: 2,
		});

		expect(options.gravity).toHaveProperty("x", expect.closeTo(0.75));
	});

	it("centres on the focal point when the image's shape is unknown", () => {
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
