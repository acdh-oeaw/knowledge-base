import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website opportunities admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that a source exists. */
		await db.getOpportunitySource();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerOpportunitiesLifecycleItems(testInfo.workerIndex);
	});

	test("should create an opportunity", async ({ createWebsiteOpportunitiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const title = `${opportunitiesPage.workerPrefix} Test Opportunity ${randomUUID()}`;
		const summary = "E2E test opportunity summary";
		const website = "https://example.com/opportunity";
		const content = `E2E opportunity content ${randomUUID()}`;

		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary(summary);
		await opportunitiesPage.fillWebsite(website);
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.fillDatePicker("End date", 2025, 6, 30);
		await opportunitiesPage.addContentBlock(content);
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getOpportunityByTitle(title);
		expect(created).toMatchObject({ summary, website });
		expect(created?.sourceId).toBeTruthy();
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-30T00:00:00.000Z"));
		const contentBlocks = await db.getOpportunityContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit all opportunity fields", async ({
		page,
		createWebsiteOpportunitiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const originalTitle = `${opportunitiesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(originalTitle);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("E2E test opportunity to be edited");
		await opportunitiesPage.fillWebsite("https://example.com/old-opportunity");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.addContentBlock("Old opportunity content");
		await opportunitiesPage.submitForm();

		await opportunitiesPage.gotoEditFromList(originalTitle);

		const updatedTitle = `${opportunitiesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test opportunity summary";
		const updatedWebsite = "https://example.com/updated-opportunity";
		const updatedContent = `Updated E2E opportunity content ${randomUUID()}`;

		await page.getByLabel("Title").fill(updatedTitle);
		await opportunitiesPage.fillSummary(updatedSummary);
		await opportunitiesPage.fillWebsite(updatedWebsite);
		await opportunitiesPage.fillDatePicker("Start date", 2026, 7, 1);
		await opportunitiesPage.fillDatePicker("End date", 2026, 7, 31);
		await opportunitiesPage.updateContentBlockText(updatedContent);
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(updatedTitle);
		await expect(opportunitiesPage.rowByTitle(updatedTitle)).toBeVisible();
		await opportunitiesPage.searchByTitle(originalTitle);
		await expect(opportunitiesPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getOpportunityByTitle(updatedTitle);
		expect(updated).toMatchObject({ summary: updatedSummary, website: updatedWebsite });
		expect(updated?.duration.start).toStrictEqual(new Date("2026-07-01T00:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2026-07-31T00:00:00.000Z"));
		const contentBlocks = await db.getOpportunityContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional opportunity fields", async ({
		createWebsiteOpportunitiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);
		const title = `${opportunitiesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("Opportunity with optional fields to clear");
		await opportunitiesPage.fillWebsite("https://example.com/opportunity-clear");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.fillDatePicker("End date", 2025, 6, 30);
		await opportunitiesPage.addContentBlock("Optional opportunity content");
		await opportunitiesPage.submitForm();

		await opportunitiesPage.gotoEditFromList(title);

		await opportunitiesPage.fillWebsite("");
		await opportunitiesPage.clearDatePicker("End date");
		await opportunitiesPage.removeFirstContentBlock();
		await opportunitiesPage.submitForm();

		const updated = await db.getOpportunityByTitle(title);
		expect(updated).toMatchObject({ website: null });
		expect(updated?.duration.end).toBeUndefined();
		expect(await db.getOpportunityContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete an opportunity", async ({ createWebsiteOpportunitiesPage }) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const title = `${opportunitiesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("E2E test opportunity to be deleted");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.rowByTitle(title)).toBeVisible();

		const deleteDialog = await opportunitiesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await opportunitiesPage.confirmDelete(deleteDialog);

		await expect(opportunitiesPage.rowByTitle(title)).toBeHidden();
	});
});
