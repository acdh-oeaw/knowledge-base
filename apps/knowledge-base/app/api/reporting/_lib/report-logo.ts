import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { images } from "@/lib/images";

/**
 * Fetches a report's branding logo as PNG bytes for embedding in a PDF. The asset is rasterized to
 * PNG by imgproxy (so SVG logos work too) and capped in width. Returns `null` when there is no logo
 * key or the fetch fails, so the caller can fall back to rendering the unit name as text instead of
 * failing the whole document.
 */
export async function fetchBrandLogo(imageKey: string | null): Promise<Buffer | null> {
	if (imageKey == null) {
		return null;
	}

	try {
		const { url } = images.generateSignedImageUrl({
			key: imageKey,
			options: { width: 240, enlarge: false, format: "png" },
		});

		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}

		return Buffer.from(await response.arrayBuffer());
	} catch {
		return null;
	}
}

let dariahWordmark: Promise<Buffer | null> | null = null;

/**
 * Rasterizes the DARIAH-EU wordmark (the logo-with-text used top-left on every report) to a PNG
 * buffer for embedding in the PDF. pdfkit cannot render SVG, so the bundled asset is converted with
 * sharp at a high enough resolution to stay crisp when scaled down. Cached for the process; returns
 * `null` on failure so the renderer can fall back to the plain logo mark.
 */
export function loadDariahWordmark(): Promise<Buffer | null> {
	dariahWordmark ??= (async () => {
		try {
			const file = path.join(process.cwd(), "public/assets/images/logo-dariah-eu.svg");
			const svg = await readFile(file);

			return await sharp(svg, { density: 300 }).resize({ height: 120 }).png().toBuffer();
		} catch {
			return null;
		}
	})();

	return dariahWordmark;
}
