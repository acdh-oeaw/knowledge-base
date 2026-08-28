import { describe, expect, it } from "vitest";

import { formatDimensions } from "@/lib/format-dimensions";

describe("formatDimensions", () => {
	it("states dimensions as width by height", () => {
		expect(formatDimensions(1600, 900)).toBe("1600 × 900");
	});

	it("has nothing to state when a dimension is missing", () => {
		/** Vectors, and assets uploaded before dimensions were tracked. */
		expect(formatDimensions(null, null)).toBe(null);
		expect(formatDimensions(1600, null)).toBe(null);
		expect(formatDimensions(null, 900)).toBe(null);
		expect(formatDimensions(undefined, undefined)).toBe(null);
	});

	it("keeps a zero dimension rather than treating it as missing", () => {
		/** `0` is a measurement, however broken - not the absence of one. */
		expect(formatDimensions(0, 0)).toBe("0 × 0");
	});
});
