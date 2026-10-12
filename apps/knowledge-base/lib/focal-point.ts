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

/** The CSS `object-position` that keeps {@link FocalPoint} in view under `object-fit: cover`. */
export function toObjectPosition(point: FocalPoint | null | undefined): string {
	const { x, y } = point ?? centreFocalPoint;

	return `${toPercent(x)} ${toPercent(y)}`;
}

/** Rounded, because `0.29 * 100` is `28.999999999999996` and that is what would end up in the css. */
export function toPercent(fraction: number): string {
	return `${String(Math.round(fraction * 10_000) / 100)}%`;
}

/**
 * How a focal point travels in a form: one hidden input holding `"x,y"`, or `"none"` to clear it. A
 * single sentinel value rather than an empty input, because `getFormDataValues` drops empty inputs
 * — an emptied field would be indistinguishable from one the form never rendered.
 */
export function formatFocalPointInput(point: FocalPoint | null): string {
	return point != null ? `${String(point.x)},${String(point.y)}` : "none";
}
