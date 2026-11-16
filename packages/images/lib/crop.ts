/**
 * Crop geometry shared by the api, which asks imgproxy for crops, and the knowledge base, which
 * previews them. A separate entry point from the imgproxy url signing, so that a client component
 * can import it without pulling in node-only code.
 *
 * One rule places every crop: the one css `object-fit: cover` with `object-position: x% y%`
 * follows, because that is how the website draws images — it downloads them uncropped and crops in
 * the browser. The point x% across the image lands x% across the frame, so a subject on the left
 * third stays on the left third, and a point at an edge keeps that edge.
 */

/** The part of a source image a crop keeps, as fractions of the source width and height. */
export interface CropFrame {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A point of the source image, as fractions of its width and height from the top left. */
export interface CropPoint {
	x: number;
	y: number;
}

const centre: CropPoint = { x: 0.5, y: 0.5 };

/**
 * The part of an image that a crop to `cropAspectRatio` keeps: scaled to cover the frame, then
 * placed like `object-position` at the focal point, or centred without one.
 */
export function getCropFrame(params: {
	cropAspectRatio: number;
	focalPoint?: CropPoint | null;
	imageAspectRatio: number;
}): CropFrame {
	const { cropAspectRatio, focalPoint, imageAspectRatio } = params;
	const point = focalPoint ?? centre;

	/** A crop wider than the image keeps its full width; a narrower one keeps its full height. */
	const width = Math.min(1, cropAspectRatio / imageAspectRatio);
	const height = Math.min(1, imageAspectRatio / cropAspectRatio);

	return { x: point.x * (1 - width), y: point.y * (1 - height), width, height };
}

/**
 * The point to hand imgproxy as `gravity: fp` for a crop placed like {@link getCropFrame}.
 *
 * Imgproxy centres the crop on its point instead, so passing the focal point through would cut a
 * different frame from the one the website shows — at `x: 0.29` on a 2:1 image cut square,
 * 0.04–0.54 of the width instead of 0.145–0.645. The centre of the css frame is a point imgproxy
 * can centre on without running into an edge, so the two agree exactly.
 */
export function getCropGravityPoint(params: {
	cropAspectRatio: number;
	focalPoint: CropPoint;
	imageAspectRatio: number;
}): CropPoint {
	const frame = getCropFrame(params);

	return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

/**
 * The part of an image every one of `frames` keeps — what stays visible wherever the image is
 * cropped. Never empty for frames placed around one focal point, since each of them contains it.
 */
export function getCropOverlap(frames: ReadonlyArray<CropFrame>): CropFrame {
	const left = Math.max(0, ...frames.map((frame) => frame.x));
	const top = Math.max(0, ...frames.map((frame) => frame.y));
	const right = Math.min(1, ...frames.map((frame) => frame.x + frame.width));
	const bottom = Math.min(1, ...frames.map((frame) => frame.y + frame.height));

	return { x: left, y: top, width: right - left, height: bottom - top };
}
