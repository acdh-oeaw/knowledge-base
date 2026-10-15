/**
 * The point of an image to keep in view when a placement crops it, as fractions of the source width
 * and height from the top left: `{ x: 0.5, y: 0.5 }` is the centre. Stored on the asset as
 * `focal_point_x`/`focal_point_y`, both null when no point was chosen.
 */
export interface FocalPoint {
	x: number;
	y: number;
}

export const centreFocalPoint: FocalPoint = { x: 0.5, y: 0.5 };

/** Both coordinates or neither: the database constraint guarantees it, this keeps the type honest. */
export function toFocalPoint(asset: {
	focalPointX: number | null;
	focalPointY: number | null;
}): FocalPoint | null {
	if (asset.focalPointX == null || asset.focalPointY == null) {
		return null;
	}

	return { x: asset.focalPointX, y: asset.focalPointY };
}

/** Kept to whole percent: finer than anyone can aim with a pointer, and it keeps the values legible. */
export function clampFocalPoint(point: FocalPoint): FocalPoint {
	function clamp(value: number): number {
		return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
	}

	return { x: clamp(point.x), y: clamp(point.y) };
}

/** Rounded, because `0.29 * 100` is `28.999999999999996` and that is what would end up in the css. */
export function toPercent(fraction: number): string {
	return `${String(Math.round(fraction * 10_000) / 100)}%`;
}

/**
 * The css `object-position` that crops an `object-fit: cover` image around {@link FocalPoint} — the
 * website's own rule, which `getCropFrame` describes and the api's crops follow.
 */
export function toObjectPosition(point: FocalPoint | null | undefined): string {
	const { x, y } = point ?? centreFocalPoint;

	return `${toPercent(x)} ${toPercent(y)}`;
}

/**
 * How a focal point travels in a form: one hidden input holding `"x,y"`, or `"none"` to clear it. A
 * single sentinel value rather than an empty input, because `getFormDataValues` drops empty inputs
 * — an emptied field would be indistinguishable from one the form never rendered.
 */
export function formatFocalPointInput(point: FocalPoint | null): string {
	return point != null ? `${String(point.x)},${String(point.y)}` : "none";
}

/** A shape an image is cropped to, named by its ratio. */
export interface PreviewCrop {
	id: string;
	aspectRatio: number;
}

/**
 * Generic shapes spanning the range the website crops a photo to — not one per slot, which would
 * tie this to its layouts. The extremes matter most, since they cut the most and so bound what
 * stays visible everywhere: 4:3, the mobile page header and narrowest card, and 8:3, close to the
 * desktop page header (1652:620). 16:9 is the link preview the api crops for `og:image`. Never a
 * square: no photo is shown as one.
 */
const imageCrops: ReadonlyArray<PreviewCrop> = [
	{ id: "4:3", aspectRatio: 4 / 3 },
	{ id: "16:9", aspectRatio: 16 / 9 },
	{ id: "8:3", aspectRatio: 8 / 3 },
];

/** A portrait is only ever cropped square, on a person's page and card. */
const avatarCrops: ReadonlyArray<PreviewCrop> = [{ id: "1:1", aspectRatio: 1 }];

/**
 * The crops an asset is shown at, going by the prefix it is stored under, which is also how the
 * website tells them apart. `null` for one that is never cropped, so a focal point would do
 * nothing: a logo is always fitted whole, and a document is not an image.
 */
export function getPreviewCrops(key: string): ReadonlyArray<PreviewCrop> | null {
	const prefix = key.split("/")[0];

	if (prefix === "images") {
		return imageCrops;
	}

	if (prefix === "avatars") {
		return avatarCrops;
	}

	return null;
}
