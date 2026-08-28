import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expectDetailsTermsInOrder } from "@/e2e/lib/fixtures/details-order";
import { expect, test } from "@/e2e/lib/test";

test.describe("website funding calls admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerFundingCallsLifecycleItems(testInfo.workerIndex);
		/** The edit test uploads a replacement image, which outlives the funding call referencing it. */
		await db.cleanupWorkerAssets(testInfo.workerIndex);
	});

	test("should show an inline validation error when a required image is missing", async ({
		createWebsiteFundingCallsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(
			`${fundingCallsPage.workerPrefix} Missing Image ${randomUUID()}`,
		);
		await fundingCallsPage.fillSummary("E2E test funding call without image");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);

		const saveButton = fundingCallsPage.page.getByRole("button", {
			name: /^Save(?! and publish\b).*$/,
		});
		await expect(saveButton).toBeEnabled();
		await saveButton.click();

		await expect(fundingCallsPage.page.getByText("Please select an image.")).toBeVisible();
	});

	test("should create a funding call", async ({ createWebsiteFundingCallsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const title = `${fundingCallsPage.workerPrefix} Test Funding Call ${randomUUID()}`;
		const summary = "E2E test funding call summary";
		const content = `E2E funding call content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		const relatedEntities = await db.getTestEntities(2);
		const relatedResources = await db.getTestResources(2);
		const relatedEntity = relatedEntities[0]!;
		const replacementEntity = relatedEntities[1]!;
		const relatedResource = relatedResources[0]!;
		const replacementResource = relatedResources[1]!;

		await fundingCallsPage.gotoCreate();
		await expect(
			fundingCallsPage.page.getByRole("heading", { name: "Related entities" }),
		).toBeVisible();
		await expect(
			fundingCallsPage.page.getByRole("heading", { name: "Related resources" }),
		).toBeVisible();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary(summary);
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.fillDatePicker("End date", 2025, 6, 30);
		await fundingCallsPage.addContentBlock(content);
		await fundingCallsPage.selectRelatedEntity(relatedEntity.name);
		await fundingCallsPage.selectRelatedResource(relatedResource.name);
		await fundingCallsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.rowByTitle(title)).toBeVisible();

		const created = await db.getFundingCallByTitle(title);
		expect(created).toMatchObject({ summary, imageId: testAsset.id });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-30T00:00:00.000Z"));
		expect(created).not.toBeNull();
		const relations = await db.getEntityRelations(created!.documentId);
		expect(relations.relatedEntityIds).toStrictEqual([relatedEntity.id]);
		expect(relations.relatedResourceIds).toStrictEqual([relatedResource.id]);
		const contentBlocks = await db.getFundingCallContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		await fundingCallsPage.gotoDetailsFromList(title);
		await expect(fundingCallsPage.detailsRelatedEntity(relatedEntity.name)).toBeVisible();
		await expect(fundingCallsPage.detailsRelatedResource(relatedResource.name)).toBeVisible();
		await expectDetailsTermsInOrder(fundingCallsPage.page, [
			"Image",
			"Content",
			"Related entities",
			"Related resources",
		]);

		await fundingCallsPage.gotoEditFromDetails();
		await expect(
			fundingCallsPage.page.getByRole("heading", { name: "Related entities" }),
		).toBeVisible();
		await expect(
			fundingCallsPage.page.getByRole("heading", { name: "Related resources" }),
		).toBeVisible();
		await expect(
			fundingCallsPage.page.getByRole("row", { name: relatedEntity.name }),
		).toBeVisible();
		await expect(
			fundingCallsPage.page.getByRole("row", { name: relatedResource.name }),
		).toBeVisible();

		await fundingCallsPage.removeRelatedEntity(relatedEntity.name);
		await fundingCallsPage.removeRelatedResource(relatedResource.name);
		await fundingCallsPage.selectRelatedEntity(replacementEntity.name);
		await fundingCallsPage.selectRelatedResource(replacementResource.name);
		await fundingCallsPage.submitForm();

		const replacedRelations = await db.getEntityRelations(created!.documentId);
		expect(replacedRelations.relatedEntityIds).toStrictEqual([replacementEntity.id]);
		expect(replacedRelations.relatedResourceIds).toStrictEqual([replacementResource.id]);

		await fundingCallsPage.gotoEditFromList(title);
		await fundingCallsPage.removeRelatedEntity(replacementEntity.name);
		await fundingCallsPage.removeRelatedResource(replacementResource.name);
		await fundingCallsPage.submitForm();

		const clearedRelations = await db.getEntityRelations(created!.documentId);
		expect(clearedRelations).toStrictEqual({ relatedEntityIds: [], relatedResourceIds: [] });
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
		await fundingCallsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await fundingCallsPage.submitForm();

		const before = await db.getFundingCallByTitle(originalTitle);
		expect(before).not.toBeNull();

		await fundingCallsPage.gotoEditFromList(originalTitle);

		const updatedTitle = `${fundingCallsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test funding call summary";
		const updatedContent = `Updated E2E funding call content ${randomUUID()}`;
		const updatedImageLabel = `${fundingCallsPage.workerPrefix} Replacement Image ${randomUUID()}`;

		await page.getByLabel("Title").fill(updatedTitle);
		await fundingCallsPage.fillSummary(updatedSummary);
		await fundingCallsPage.fillDatePicker("Start date", 2026, 7, 1);
		await fundingCallsPage.fillDatePicker("End date", 2026, 7, 31);
		await fundingCallsPage.updateContentBlockText(updatedContent);
		await fundingCallsPage.uploadImageFromMediaLibrary(
			join(process.cwd(), "public/android-chrome-192x192.png"),
			updatedImageLabel,
		);
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(updatedTitle);
		await expect(fundingCallsPage.rowByTitle(updatedTitle)).toBeVisible();
		await fundingCallsPage.searchByTitle(originalTitle);
		await expect(fundingCallsPage.rowByTitle(originalTitle)).toBeHidden();

		const replacementAsset = await db.getAssetByLabel(updatedImageLabel);
		expect(replacementAsset).not.toBeNull();
		const updated = await db.getFundingCallByTitle(updatedTitle);
		expect(updated).toMatchObject({ summary: updatedSummary, imageId: replacementAsset!.id });
		expect(updated?.imageId).not.toBe(before!.imageId);
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
		await fundingCallsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.gotoEditFromList(title);

		await fundingCallsPage.clearDatePicker("End date");
		await fundingCallsPage.removeFirstContentBlock();
		await fundingCallsPage.submitForm();

		const updated = await db.getFundingCallByTitle(title);
		expect(updated?.duration.end).toBeUndefined();
		expect(await db.getFundingCallContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete a funding call", async ({ createWebsiteFundingCallsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const title = `${fundingCallsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary("E2E test funding call to be deleted");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.rowByTitle(title)).toBeVisible();

		const created = await db.getFundingCallByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await fundingCallsPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await fundingCallsPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(fundingCallsPage.rowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getFundingCallByTitle(title)).toBeNull();
	});
});
