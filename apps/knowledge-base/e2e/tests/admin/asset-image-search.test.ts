import { E2E_TEST_ASSET_LABEL } from "@/e2e/lib/fixtures/database-service";
import { expect, test } from "@/e2e/lib/test";

/**
 * Regression coverage for image search. The label filter is applied as a raw `unaccent(...) ILIKE`
 * fragment; a mismatch between the referenced table name and the query's table alias made every
 * search throw a database error. These tests exercise both entry points that hit that code path:
 * the assets list page (`getAssetsForDashboard`) and the media library dialog
 * (`getMediaLibraryAssets` via `/api/assets`).
 */
test.describe("asset image search", () => {
	test("returns matching assets on the assets list page", async ({ createAssetsPage }) => {
		const assetsPage = createAssetsPage();

		await assetsPage.goto();
		await assetsPage.search(E2E_TEST_ASSET_LABEL);

		await expect(assetsPage.assetCardByLabel(E2E_TEST_ASSET_LABEL).first()).toBeVisible();
	});

	test("returns matching assets in the media library dialog", async ({ createAssetsPage }) => {
		const assetsPage = createAssetsPage();

		const dialog = await assetsPage.openMediaLibraryDialog();
		const response = await assetsPage.searchInMediaLibrary(dialog, E2E_TEST_ASSET_LABEL);

		expect(response.ok()).toBe(true);
		await expect(
			assetsPage.mediaLibraryAssetByLabel(dialog, E2E_TEST_ASSET_LABEL).first(),
		).toBeVisible();
	});
});
