import { describe, expect, it } from "vitest";

import { getAspectRatio, getSvgAspectRatio } from "./aspect-ratio";

describe("getAspectRatio", () => {
	it("returns the width/height ratio for a raster image", () => {
		expect(getAspectRatio(1600, 900)).toBe(16 / 9);
	});

	it("returns null for invalid dimensions", () => {
		expect(getAspectRatio(0, 900)).toBeNull();
	});
});

describe("getSvgAspectRatio", () => {
	it("uses the viewBox when it is present", () => {
		expect(getSvgAspectRatio(Buffer.from('<svg viewBox="0 0 1920 1080"></svg>'))).toBe(1920 / 1080);
	});

	it("falls back to compatible width and height attributes", () => {
		expect(getSvgAspectRatio(Buffer.from('<svg width="640px" height="480"></svg>'))).toBe(4 / 3);
	});

	it("prefers the viewBox over presentation dimensions", () => {
		expect(
			getSvgAspectRatio(
				Buffer.from('<svg width="100" height="100" viewBox="10 20 400 200"></svg>'),
			),
		).toBe(2);
	});

	it("returns null for relative dimensions without a viewBox", () => {
		expect(getSvgAspectRatio(Buffer.from('<svg width="100%" height="auto"></svg>'))).toBeNull();
	});

	it("returns null for invalid or non-positive dimensions", () => {
		expect(getSvgAspectRatio(Buffer.from('<svg viewBox="0 0 0 100"></svg>'))).toBeNull();
	});
});
