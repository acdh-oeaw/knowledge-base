import { expect, test } from "@/e2e/lib/test";

test.describe("asset uploads", () => {
	test("offers document file types for the documents prefix", async ({ createAssetsPage }) => {
		const assetsPage = createAssetsPage();
		const dialog = await assetsPage.openUploadAssetDialog();
		const fileInput = dialog.locator('input[type="file"]');

		await expect(fileInput).not.toHaveAttribute("accept", /application\/pdf/);

		await assetsPage.selectUploadPrefix(dialog, "documents");

		await expect(fileInput).toHaveAttribute("accept", /application\/pdf/);
	});
});
