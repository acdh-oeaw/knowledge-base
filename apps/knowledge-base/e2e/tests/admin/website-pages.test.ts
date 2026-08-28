import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website pages admin", () => {
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
		await db.cleanupWorkerPageItems(testInfo.workerIndex);
	});

	test("should create a page", async ({ createWebsitePagesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const title = `${pagesPage.workerPrefix} Test Page ${randomUUID()}`;
		const summary = "E2E test page summary";
		const testAsset = await db.getTestAsset();

		await pagesPage.gotoCreate();

		await pagesPage.fillTitle(title);
		await pagesPage.fillSummary(summary);
		await pagesPage.fillPublicationDate(2025, 1, 15);
		await pagesPage.selectImageFromMediaLibrary("E2E Test Asset");

		await pagesPage.submitForm();

		await pagesPage.searchByTitle(title);
		await expect(pagesPage.pageRowByTitle(title)).toBeVisible();

		const created = await db.getPageItemByTitle(title);
		expect(created).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2025-01-15T00:00:00.000Z"),
			summary,
		});
	});

	test("should edit all page form fields", async ({ page, createWebsitePagesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const originalTitle = `${pagesPage.workerPrefix} Edit Me ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		await pagesPage.gotoCreate();
		await pagesPage.fillTitle(originalTitle);
		await pagesPage.fillSummary("E2E test page to be edited");
		await pagesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await pagesPage.submitForm();

		await pagesPage.searchByTitle(originalTitle);
		const row = pagesPage.pageRowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${pagesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test page summary";
		await page.getByLabel("Title").fill(updatedTitle);
		await pagesPage.fillSummary(updatedSummary);
		await pagesPage.fillPublicationDate(2026, 2, 16);
		await pagesPage.selectImageFromMediaLibrary("E2E Test Asset");

		await pagesPage.submitForm();

		await pagesPage.searchByTitle(updatedTitle);
		await expect(pagesPage.pageRowByTitle(updatedTitle)).toBeVisible();
		await pagesPage.searchByTitle(originalTitle);
		await expect(pagesPage.pageRowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getPageItemByTitle(updatedTitle);
		expect(updated).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2026-02-16T00:00:00.000Z"),
			summary: updatedSummary,
		});
	});

	test("should clear an optional image when editing a page", async ({
		db,
		page,
		createWebsitePagesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const title = `${pagesPage.workerPrefix} Clear Image ${randomUUID()}`;
		await pagesPage.gotoCreate();
		await pagesPage.fillTitle(title);
		await pagesPage.fillSummary("E2E test page with image to clear");
		await pagesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await pagesPage.submitForm();

		const createdPage = await db.getPageItemByTitle(title);
		expect(createdPage?.imageId).not.toBeNull();

		await pagesPage.searchByTitle(title);
		const row = pagesPage.pageRowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await pagesPage.removeImage();
		await pagesPage.submitForm();

		const updatedPage = await db.getPageItemByTitle(title);
		expect(updatedPage?.imageId).toBeNull();
	});

	test("should delete a page", async ({ createWebsitePagesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const title = `${pagesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await pagesPage.gotoCreate();
		await pagesPage.fillTitle(title);
		await pagesPage.fillSummary("E2E test page to be deleted");
		await pagesPage.submitForm();

		await pagesPage.searchByTitle(title);
		await expect(pagesPage.pageRowByTitle(title)).toBeVisible();

		const created = await db.getPageItemByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await pagesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await pagesPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(pagesPage.pageRowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getPageItemByTitle(title)).toBeNull();
	});
});
