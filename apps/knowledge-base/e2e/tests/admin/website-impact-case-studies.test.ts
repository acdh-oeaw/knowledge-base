import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website impact case studies admin", () => {
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
		await db.cleanupWorkerImpactCaseStudies(testInfo.workerIndex);
	});

	test("should create an impact case study", async ({ createWebsiteImpactCaseStudiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const title = `${impactCaseStudiesPage.workerPrefix} Test ICS ${randomUUID()}`;
		const summary = "E2E test impact case study summary";
		const content = `E2E impact case study content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();

		await impactCaseStudiesPage.gotoCreate();

		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary(summary);
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock(content);

		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getImpactCaseStudyByTitle(title);
		expect(created).toMatchObject({ imageId: testAsset.id, summary });
		const contentBlocks = await db.getImpactCaseStudyContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit an impact case study title", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const originalTitle = `${impactCaseStudiesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(originalTitle);
		await impactCaseStudiesPage.fillSummary("E2E test impact case study to be edited");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock("Old impact case study content");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(originalTitle);
		const row = impactCaseStudiesPage.rowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${impactCaseStudiesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E impact case study summary";
		const updatedContent = `Updated impact case study content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		await page.getByLabel("Title").fill(updatedTitle);
		await impactCaseStudiesPage.fillSummary(updatedSummary);
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.updateContentBlockText(updatedContent);

		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(updatedTitle);
		await expect(impactCaseStudiesPage.rowByTitle(updatedTitle)).toBeVisible();
		await impactCaseStudiesPage.searchByTitle(originalTitle);
		await expect(impactCaseStudiesPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getImpactCaseStudyByTitle(updatedTitle);
		expect(updated).toMatchObject({ imageId: testAsset.id, summary: updatedSummary });
		const contentBlocks = await db.getImpactCaseStudyContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional impact case study content blocks", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);
		const title = `${impactCaseStudiesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary("Impact case study with content to clear");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock("Optional impact case study content");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		const row = impactCaseStudiesPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
		await impactCaseStudiesPage.removeFirstContentBlock();
		await impactCaseStudiesPage.submitForm();

		expect(await db.getImpactCaseStudyContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete an impact case study", async ({ createWebsiteImpactCaseStudiesPage }) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const title = `${impactCaseStudiesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary("E2E test impact case study to be deleted");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeVisible();

		const deleteDialog = await impactCaseStudiesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await impactCaseStudiesPage.confirmDelete(deleteDialog);

		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeHidden();
	});
});
