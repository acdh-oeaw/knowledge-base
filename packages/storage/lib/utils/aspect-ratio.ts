const dimensionPattern = /^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?$/i;

function parseDimension(value: string | undefined): number | null {
	if (value == null) {
		return null;
	}

	const match = dimensionPattern.exec(value.trim());
	if (match == null) {
		return null;
	}

	const dimension = Number(match[1]);
	return Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function readAttributes(svg: string): Map<string, string> | null {
	const root = /<svg\b([^>]*)>/i.exec(svg);
	if (root == null) {
		return null;
	}

	const attributes = new Map<string, string>();
	const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
	for (const match of (root[1] ?? "").matchAll(pattern)) {
		const name = match[1];
		if (name != null) {
			attributes.set(name.toLowerCase(), match[2] ?? match[3] ?? "");
		}
	}

	return attributes;
}

/** Returns the intrinsic width/height ratio declared by an SVG, when it has one. */
export function getSvgAspectRatio(input: Buffer | string): number | null {
	const attributes = readAttributes(typeof input === "string" ? input : input.toString("utf-8"));
	if (attributes == null) {
		return null;
	}

	const viewBox = attributes.get("viewbox");
	if (viewBox != null) {
		const values = viewBox
			.trim()
			.split(/[\s,]+/)
			.map(Number);
		if (values.length === 4) {
			const width = values[2];
			const height = values[3];
			if (
				width != null &&
				height != null &&
				Number.isFinite(width) &&
				Number.isFinite(height) &&
				width > 0 &&
				height > 0
			) {
				return width / height;
			}
		}
	}

	const width = parseDimension(attributes.get("width"));
	const height = parseDimension(attributes.get("height"));
	return width != null && height != null ? width / height : null;
}

export function getAspectRatio(width: number, height: number): number | null {
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
		? width / height
		: null;
}
