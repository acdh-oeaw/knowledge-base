import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { Locator } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

/**
 * Exported svgs often declare only a `viewBox`: a shape, but no size. Inside the picker's
 * shrink-to-fit box such an image collapsed to nothing, leaving no image to see and nothing to
 * click. The raster image is the control, which has always had a size of its own.
 */
const uploads = [
	{
		title: "an svg with only a viewBox",
		file: {
			name: "viewbox-only.svg",
			mimeType: "image/svg+xml",
			buffer: Buffer.from(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><rect width="800" height="400" fill="teal"/></svg>',
			),
		},
		aspectRatio: 2,
	},
	{
		title: "a raster image",
		file: join(process.cwd(), "public/android-chrome-192x192.png"),
		aspectRatio: 1,
	},
];

async function getBox(locator: Locator): Promise<{ width: number; height: number }> {
	const box = await locator.boundingBox();
	if (box == null) {
		throw new Error("Could not resolve the bounding box of the focal point picker.");
	}

	return box;
}

test.describe("asset focal point", () => {
	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerAssets(testInfo.workerIndex);
	});

	for (const { title, file, aspectRatio } of uploads) {
		test(`can be picked on ${title}`, async ({ createAssetsPage, db }) => {
			const assetsPage = createAssetsPage();
			const label = `[e2e-worker-${String(test.info().workerIndex)}] Focal Point ${randomUUID()}`;

			await assetsPage.uploadAsset(file, label);

			const dialog = await assetsPage.openEditAssetMetadataDialog(label);
			const picker = dialog.getByRole("slider", { name: "Focal point" });

			/** The picker wraps the image exactly, so its box is the image's: drawn, and in its shape. */
			await expect
				.poll(async () => {
					const { width, height } = await getBox(picker);
					return width / height;
				})
				.toBeCloseTo(aspectRatio, 1);

			const box = await getBox(picker);
			await picker.click({ position: { x: box.width * 0.25, y: box.height * 0.75 } });
			await dialog.getByRole("button", { name: "Save" }).click();
			await dialog.waitFor({ state: "hidden" });

			/** To the nearest few percent: a click lands on a pixel, not on an exact fraction. */
			const asset = await db.getAssetByLabel(label);
			expect(asset?.focalPointX).toBeCloseTo(0.25, 1);
			expect(asset?.focalPointY).toBeCloseTo(0.75, 1);
		});
	}
});
