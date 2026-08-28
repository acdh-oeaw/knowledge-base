import { describe, expect, it } from "vitest";

import { toDisplayDimensions } from "./dimensions";

/**
 * The eight EXIF orientations split into two groups: 1–4 flip or mirror the image within its frame,
 * 5–8 additionally turn it a quarter turn, which transposes the frame itself. Only the second group
 * changes the dimensions a viewer sees, and getting that boundary wrong is invisible in review —
 * the aspect ratio still looks plausible, just sideways.
 */
describe("toDisplayDimensions", () => {
	it("reports the buffer's own dimensions when there is no orientation tag", () => {
		// The common case: png and webp carry no EXIF orientation at all.
		expect(toDisplayDimensions({ width: 1600, height: 900, orientation: undefined })).toEqual({
			width: 1600,
			height: 900,
		});
	});

	it("reports the buffer's own dimensions for the orientations that do not turn the image", () => {
		// 1 normal, 2 mirrored, 3 rotated 180°, 4 mirrored vertically — all keep the frame's axes.
		for (const orientation of [1, 2, 3, 4]) {
			expect(toDisplayDimensions({ width: 1600, height: 900, orientation })).toEqual({
				width: 1600,
				height: 900,
			});
		}
	});

	it("transposes the dimensions for the quarter-turn orientations", () => {
		// 5 and 7 are mirrored quarter turns, 6 and 8 are the plain ones — all four swap the axes.
		for (const orientation of [5, 6, 7, 8]) {
			expect(toDisplayDimensions({ width: 1600, height: 900, orientation })).toEqual({
				width: 900,
				height: 1600,
			});
		}
	});

	it("reports a phone's portrait photo as portrait", () => {
		/**
		 * The case this function exists for. A phone writes the sensor's landscape buffer and records
		 * the turn as orientation 6; imgproxy auto-rotates on the way out, so the served image is
		 * portrait and the recorded dimensions have to say so.
		 */
		expect(toDisplayDimensions({ width: 4032, height: 3024, orientation: 6 })).toEqual({
			width: 3024,
			height: 4032,
		});
	});

	it("is a no-op for square images whatever the orientation", () => {
		expect(toDisplayDimensions({ width: 400, height: 400, orientation: 6 })).toEqual({
			width: 400,
			height: 400,
		});
	});

	it("accepts what `buffer.getMetadata` returns, extra fields and all", () => {
		/**
		 * Both call sites pass a sharp metadata object straight through, so the parameter has to stay
		 * structurally satisfied by it rather than requiring an exact shape.
		 */
		const metadata = {
			"content-type": "image/jpeg",
			format: "jpeg",
			width: 1600,
			height: 900,
			orientation: 8,
			size: 123_456,
		};

		expect(toDisplayDimensions(metadata)).toEqual({ width: 900, height: 1600 });
	});
});
