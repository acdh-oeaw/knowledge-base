import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expectDetailsTermsInOrder } from "@/e2e/lib/fixtures/details-order";
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
		/** The edit test uploads a replacement image, which outlives the opportunity referencing it. */
		await db.cleanupWorkerAssets(testInfo.workerIndex);
	});

	test("should show an inline validation error when a required image is missing", async ({
		createWebsiteOpportunitiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(
			`${opportunitiesPage.workerPrefix} Missing Image ${randomUUID()}`,
		);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("E2E test opportunity without image");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);

		const saveButton = opportunitiesPage.page.getByRole("button", {
			name: /^Save(?! and publish\b).*$/,
		});
		await expect(saveButton).toBeEnabled();
		await saveButton.click();

		await expect(opportunitiesPage.page.getByText("Please select an image.")).toBeVisible();
	});

	test("should create an opportunity", async ({ createWebsiteOpportunitiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const title = `${opportunitiesPage.workerPrefix} Test Opportunity ${randomUUID()}`;
		const summary = "E2E test opportunity summary";
		const website = "https://example.com/opportunity";
		const content = `E2E opportunity content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		const relatedEntities = await db.getTestEntities(2);
		const relatedResources = await db.getTestResources(2);
		const relatedEntity = relatedEntities[0]!;
		const replacementEntity = relatedEntities[1]!;
		const relatedResource = relatedResources[0]!;
		const replacementResource = relatedResources[1]!;

		await opportunitiesPage.gotoCreate();
		await expect(
			opportunitiesPage.page.getByRole("heading", { name: "Related entities" }),
		).toBeVisible();
		await expect(
			opportunitiesPage.page.getByRole("heading", { name: "Related resources" }),
		).toBeVisible();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary(summary);
		await opportunitiesPage.fillWebsite(website);
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.fillDatePicker("End date", 2025, 6, 30);
		await opportunitiesPage.addContentBlock(content);
		await opportunitiesPage.selectRelatedEntity(relatedEntity.name);
		await opportunitiesPage.selectRelatedResource(relatedResource.name);
		await opportunitiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getOpportunityByTitle(title);
		expect(created).toMatchObject({ summary, website, imageId: testAsset.id });
		expect(created?.sourceId).toBeTruthy();
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-30T00:00:00.000Z"));
		expect(created).not.toBeNull();
		const relations = await db.getEntityRelations(created!.documentId);
		expect(relations.relatedEntityIds).toStrictEqual([relatedEntity.id]);
		expect(relations.relatedResourceIds).toStrictEqual([relatedResource.id]);
		const contentBlocks = await db.getOpportunityContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		await opportunitiesPage.gotoDetailsFromList(title);
		await expect(opportunitiesPage.detailsRelatedEntity(relatedEntity.name)).toBeVisible();
		await expect(opportunitiesPage.detailsRelatedResource(relatedResource.name)).toBeVisible();
		await expectDetailsTermsInOrder(opportunitiesPage.page, [
			"Image",
			"Content",
			"Related entities",
			"Related resources",
		]);

		await opportunitiesPage.gotoEditFromDetails();
		await expect(
			opportunitiesPage.page.getByRole("heading", { name: "Related entities" }),
		).toBeVisible();
		await expect(
			opportunitiesPage.page.getByRole("heading", { name: "Related resources" }),
		).toBeVisible();
		await expect(
			opportunitiesPage.page.getByRole("row", { name: relatedEntity.name }),
		).toBeVisible();
		await expect(
			opportunitiesPage.page.getByRole("row", { name: relatedResource.name }),
		).toBeVisible();

		await opportunitiesPage.removeRelatedEntity(relatedEntity.name);
		await opportunitiesPage.removeRelatedResource(relatedResource.name);
		await opportunitiesPage.selectRelatedEntity(replacementEntity.name);
		await opportunitiesPage.selectRelatedResource(replacementResource.name);
		await opportunitiesPage.submitForm();

		const replacedRelations = await db.getEntityRelations(created!.documentId);
		expect(replacedRelations.relatedEntityIds).toStrictEqual([replacementEntity.id]);
		expect(replacedRelations.relatedResourceIds).toStrictEqual([replacementResource.id]);

		await opportunitiesPage.gotoEditFromList(title);
		await opportunitiesPage.removeRelatedEntity(replacementEntity.name);
		await opportunitiesPage.removeRelatedResource(replacementResource.name);
		await opportunitiesPage.submitForm();

		const clearedRelations = await db.getEntityRelations(created!.documentId);
		expect(clearedRelations).toStrictEqual({ relatedEntityIds: [], relatedResourceIds: [] });
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
		await opportunitiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await opportunitiesPage.submitForm();

		const before = await db.getOpportunityByTitle(originalTitle);
		expect(before).not.toBeNull();

		await opportunitiesPage.gotoEditFromList(originalTitle);

		const updatedTitle = `${opportunitiesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test opportunity summary";
		const updatedWebsite = "https://example.com/updated-opportunity";
		const updatedContent = `Updated E2E opportunity content ${randomUUID()}`;
		const updatedImageLabel = `${opportunitiesPage.workerPrefix} Replacement Image ${randomUUID()}`;

		await page.getByLabel("Title").fill(updatedTitle);
		await opportunitiesPage.fillSummary(updatedSummary);
		await opportunitiesPage.fillWebsite(updatedWebsite);
		await opportunitiesPage.fillDatePicker("Start date", 2026, 7, 1);
		await opportunitiesPage.fillDatePicker("End date", 2026, 7, 31);
		await opportunitiesPage.updateContentBlockText(updatedContent);
		await opportunitiesPage.uploadImageFromMediaLibrary(
			join(process.cwd(), "public/android-chrome-192x192.png"),
			updatedImageLabel,
		);
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(updatedTitle);
		await expect(opportunitiesPage.rowByTitle(updatedTitle)).toBeVisible();
		await opportunitiesPage.searchByTitle(originalTitle);
		await expect(opportunitiesPage.rowByTitle(originalTitle)).toBeHidden();

		const replacementAsset = await db.getAssetByLabel(updatedImageLabel);
		expect(replacementAsset).not.toBeNull();
		const updated = await db.getOpportunityByTitle(updatedTitle);
		expect(updated).toMatchObject({
			summary: updatedSummary,
			website: updatedWebsite,
			imageId: replacementAsset!.id,
		});
		expect(updated?.imageId).not.toBe(before!.imageId);
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
		await opportunitiesPage.selectImageFromMediaLibrary("E2E Test Asset");
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

	test("should delete an opportunity", async ({ createWebsiteOpportunitiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const title = `${opportunitiesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("E2E test opportunity to be deleted");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getOpportunityByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await opportunitiesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await opportunitiesPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(opportunitiesPage.rowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getOpportunityByTitle(title)).toBeNull();
	});
});
