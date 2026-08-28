/**
 * The asset's pixel dimensions, for the metadata lines that already state its file size. Authors
 * read these to tell whether an asset is large enough for the placement they are filling - a file
 * size cannot answer that on its own.
 *
 * Null whenever there is nothing truthful to state: vector images have no raster resolution, and
 * assets uploaded before dimensions were tracked have none recorded until
 * `data:backfill:image-dimensions` has measured them. Callers drop the segment rather than
 * rendering a placeholder, so a logo in SVG does not read as an asset with broken metadata.
 */
export function formatDimensions(
	width: number | null | undefined,
	height: number | null | undefined,
): string | null {
	if (width == null || height == null) {
		return null;
	}

	return `${String(width)} × ${String(height)}`;
}
