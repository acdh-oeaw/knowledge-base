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
 * Generic shapes spanning the range the CLARIAH-AT website crops a photo to — not one per slot,
 * which would tie this to its layouts. The extremes matter most, since they cut the most and so
 * bound what stays visible everywhere: 4:3, an event card (and a news or project card on the
 * narrowest phones), and 3:1, a detail page header on wide screens (`aspect-2/1`, capped at
 * `max-h-100`) and a single-column card just below two columns. 2:1 is the detail page header
 * itself, the most prominent crop. Never a square: no photo is shown as one. Link previews show the
 * whole image, so they need no shape of their own.
 */
const imageCrops: ReadonlyArray<PreviewCrop> = [
	{ id: "4:3", aspectRatio: 4 / 3 },
	{ id: "2:1", aspectRatio: 2 },
	{ id: "3:1", aspectRatio: 3 },
];

/** A portrait is only ever cropped square, as in a quote's byline. */
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
