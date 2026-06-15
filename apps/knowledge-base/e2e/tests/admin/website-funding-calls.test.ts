import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website funding calls admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerFundingCallsLifecycleItems(testInfo.workerIndex);
	});

	test("should create a funding call", async ({ createWebsiteFundingCallsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const title = `${fundingCallsPage.workerPrefix} Test Funding Call ${randomUUID()}`;
		const summary = "E2E test funding call summary";
		const content = `E2E funding call content ${randomUUID()}`;

		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary(summary);
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.fillDatePicker("End date", 2025, 6, 30);
		await fundingCallsPage.addContentBlock(content);
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.rowByTitle(title)).toBeVisible();

		const created = await db.getFundingCallByTitle(title);
		expect(created).toMatchObject({ summary });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-30T00:00:00.000Z"));
		const contentBlocks = await db.getFundingCallContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit all funding call fields", async ({
		page,
		createWebsiteFundingCallsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const originalTitle = `${fundingCallsPage.workerPrefix} Edit Me ${randomUUID()}`;
		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(originalTitle);
		await fundingCallsPage.fillSummary("E2E test funding call to be edited");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.addContentBlock("Old funding call content");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.gotoEditFromList(originalTitle);

		const updatedTitle = `${fundingCallsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test funding call summary";
		const updatedContent = `Updated E2E funding call content ${randomUUID()}`;

		await page.getByLabel("Title").fill(updatedTitle);
		await fundingCallsPage.fillSummary(updatedSummary);
		await fundingCallsPage.fillDatePicker("Start date", 2026, 7, 1);
		await fundingCallsPage.fillDatePicker("End date", 2026, 7, 31);
		await fundingCallsPage.updateContentBlockText(updatedContent);
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(updatedTitle);
		await expect(fundingCallsPage.rowByTitle(updatedTitle)).toBeVisible();
		await fundingCallsPage.searchByTitle(originalTitle);
		await expect(fundingCallsPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getFundingCallByTitle(updatedTitle);
		expect(updated).toMatchObject({ summary: updatedSummary });
		expect(updated?.duration.start).toStrictEqual(new Date("2026-07-01T00:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2026-07-31T00:00:00.000Z"));
		const contentBlocks = await db.getFundingCallContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional funding call fields", async ({
		createWebsiteFundingCallsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);
		const title = `${fundingCallsPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary("Funding call with optional fields to clear");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.fillDatePicker("End date", 2025, 6, 30);
		await fundingCallsPage.addContentBlock("Optional funding call content");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.gotoEditFromList(title);

		await fundingCallsPage.clearDatePicker("End date");
		await fundingCallsPage.removeFirstContentBlock();
		await fundingCallsPage.submitForm();

		const updated = await db.getFundingCallByTitle(title);
		expect(updated?.duration.end).toBeUndefined();
		expect(await db.getFundingCallContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete a funding call", async ({ createWebsiteFundingCallsPage }) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const title = `${fundingCallsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary("E2E test funding call to be deleted");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.rowByTitle(title)).toBeVisible();

		const deleteDialog = await fundingCallsPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await fundingCallsPage.confirmDelete(deleteDialog);

		await expect(fundingCallsPage.rowByTitle(title)).toBeHidden();
	});
});
