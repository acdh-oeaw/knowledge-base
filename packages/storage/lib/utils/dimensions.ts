export interface Dimensions {
	width: number;
	height: number;
}

interface MeasuredImage {
	width: number;
	height: number;
	orientation: number | undefined;
}

/**
 * EXIF orientations that turn the image a quarter turn, so that what a viewer sees is the stored
 * pixel buffer transposed.
 *
 * @see {@link https://exiftool.org/TagNames/EXIF.html}
 */
const quarterTurnOrientations = new Set([5, 6, 7, 8]);

/**
 * The dimensions an image is _displayed_ at, given what `sharp` measured on its pixel buffer.
 *
 * `sharp` reports the buffer's own width and height and leaves EXIF orientation as a separate tag,
 * but imgproxy auto-rotates (`IMGPROXY_AUTO_ROTATE`, on by default), so a portrait photo off a
 * phone — stored landscape with an orientation tag — is served portrait. Recording the buffer's
 * dimensions verbatim would describe every such image with its axes swapped, which is exactly the
 * error a consumer cannot detect: the aspect ratio looks plausible, just sideways.
 */
export function toDisplayDimensions(image: MeasuredImage): Dimensions {
	const { height, orientation, width } = image;

	if (orientation != null && quarterTurnOrientations.has(orientation)) {
		return { width: height, height: width };
	}

	return { width, height };
}
