import { getCropFrame, getCropGravityPoint, getCropOverlap } from "@dariah-eric/images/crop";
import { describe, expect, it } from "vitest";

describe("getCropFrame", () => {
	it("keeps the full height of an image cropped narrower, centred without a focal point", () => {
		expect(getCropFrame({ imageAspectRatio: 2, cropAspectRatio: 1 })).toStrictEqual({
			x: 0.25,
			y: 0,
			width: 0.5,
			height: 1,
		});
	});

	it("keeps the full width of an image cropped wider", () => {
		const frame = getCropFrame({ imageAspectRatio: 1, cropAspectRatio: 2 });

		expect(frame).toStrictEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
	});

	it("places the frame like css `object-position` at the focal point", () => {
		/* `object-position: 29%` puts the point 29% across the frame as well as across the image. */
		const frame = getCropFrame({
			imageAspectRatio: 2,
			cropAspectRatio: 1,
			focalPoint: { x: 0.29, y: 0.5 },
		});

		expect(frame.x).toBeCloseTo(0.145);
		expect((0.29 - frame.x) / frame.width).toBeCloseTo(0.29);
	});

	it("keeps a focal point at an edge at that edge", () => {
		expect(
			getCropFrame({ imageAspectRatio: 2, cropAspectRatio: 1, focalPoint: { x: 0, y: 0.5 } }).x,
		).toBe(0);
		expect(
			getCropFrame({ imageAspectRatio: 2, cropAspectRatio: 1, focalPoint: { x: 1, y: 0.5 } }).x,
		).toBe(0.5);
		expect(
			getCropFrame({ imageAspectRatio: 1, cropAspectRatio: 2, focalPoint: { x: 0.5, y: 1 } }).y,
		).toBe(0.5);
	});

	it("keeps the whole image when the crop has its shape", () => {
		expect(
			getCropFrame({
				imageAspectRatio: 16 / 9,
				cropAspectRatio: 16 / 9,
				focalPoint: { x: 0.1, y: 0.9 },
			}),
		).toStrictEqual({ x: 0, y: 0, width: 1, height: 1 });
	});
});

describe("getCropGravityPoint", () => {
	it("is the centre of the css frame, so imgproxy centring on it cuts the same frame", () => {
		const params = { imageAspectRatio: 2, cropAspectRatio: 1, focalPoint: { x: 0.29, y: 0.43 } };
		const frame = getCropFrame(params);
		const point = getCropGravityPoint(params);

		expect(point.x).toBeCloseTo(0.395);
		/* Nothing is cut vertically, so any `y` cuts the same frame; the centre is the honest one. */
		expect(point.y).toBeCloseTo(0.5);
		/* Centred on the point, the frame stays inside the image, so imgproxy has nothing to clamp. */
		expect(point.x - frame.width / 2).toBeCloseTo(frame.x);
		expect(point.x - frame.width / 2).toBeGreaterThanOrEqual(0);
		expect(point.x + frame.width / 2).toBeLessThanOrEqual(1);
	});
});

describe("getCropOverlap", () => {
	it("is what every crop keeps", () => {
		/* The guide's 3:2 source: 4:3 cuts the sides, 8:3 the top and bottom. */
		const frames = [4 / 3, 8 / 3].map((cropAspectRatio) =>
			getCropFrame({ imageAspectRatio: 3 / 2, cropAspectRatio }),
		);
		const overlap = getCropOverlap(frames);

		expect(overlap.x).toBeCloseTo(1 / 18);
		expect(overlap.width).toBeCloseTo(8 / 9);
		expect(overlap.y).toBeCloseTo(7 / 32);
		expect(overlap.height).toBeCloseTo(9 / 16);
	});

	it("always contains the focal point", () => {
		const focalPoint = { x: 0.9, y: 0.1 };
		const overlap = getCropOverlap(
			[1, 4 / 3, 16 / 9, 8 / 3].map((cropAspectRatio) =>
				getCropFrame({ imageAspectRatio: 3 / 2, cropAspectRatio, focalPoint }),
			),
		);

		expect(overlap.x).toBeLessThanOrEqual(focalPoint.x);
		expect(overlap.x + overlap.width).toBeGreaterThanOrEqual(focalPoint.x);
		expect(overlap.y).toBeLessThanOrEqual(focalPoint.y);
		expect(overlap.y + overlap.height).toBeGreaterThanOrEqual(focalPoint.y);
	});
});
