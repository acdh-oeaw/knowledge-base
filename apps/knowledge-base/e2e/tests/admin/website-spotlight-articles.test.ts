import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website spotlight articles admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that global prerequisites exist. */
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerSpotlightArticles(testInfo.workerIndex);
	});

	test("should create a spotlight article", async ({ createWebsiteSpotlightArticlesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Test SA ${randomUUID()}`;
		const summary = "E2E test spotlight article summary";
		const content = `E2E spotlight article content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();

		await spotlightArticlesPage.gotoCreate();

		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary(summary);
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock(content);

		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getSpotlightArticleByTitle(title);
		expect(created).toMatchObject({ imageId: testAsset.id, summary });
		const contentBlocks = await db.getSpotlightArticleContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit a spotlight article title", async ({
		page,
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const originalTitle = `${spotlightArticlesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(originalTitle);
		await spotlightArticlesPage.fillSummary("E2E test spotlight article to be edited");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock("Old spotlight article content");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(originalTitle);
		const row = spotlightArticlesPage.rowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${spotlightArticlesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E spotlight article summary";
		const updatedContent = `Updated spotlight article content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		await page.getByLabel("Title").fill(updatedTitle);
		await spotlightArticlesPage.fillSummary(updatedSummary);
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.updateContentBlockText(updatedContent);

		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(updatedTitle);
		await expect(spotlightArticlesPage.rowByTitle(updatedTitle)).toBeVisible();
		await spotlightArticlesPage.searchByTitle(originalTitle);
		await expect(spotlightArticlesPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getSpotlightArticleByTitle(updatedTitle);
		expect(updated).toMatchObject({ imageId: testAsset.id, summary: updatedSummary });
		const contentBlocks = await db.getSpotlightArticleContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional spotlight article content blocks", async ({
		page,
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);
		const title = `${spotlightArticlesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("Spotlight article with content to clear");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock("Optional spotlight article content");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		const row = spotlightArticlesPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
		await spotlightArticlesPage.removeFirstContentBlock();
		await spotlightArticlesPage.submitForm();

		expect(await db.getSpotlightArticleContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete a spotlight article", async ({ createWebsiteSpotlightArticlesPage }) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("E2E test spotlight article to be deleted");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeVisible();

		const deleteDialog = await spotlightArticlesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await spotlightArticlesPage.confirmDelete(deleteDialog);

		await expect(spotlightArticlesPage.rowByTitle(title)).toBeHidden();
	});
});
