import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website opportunities lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getOpportunitySource();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerOpportunitiesLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		page,
		createWebsiteOpportunitiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const title = `${opportunitiesPage.workerPrefix} Lifecycle ${randomUUID()}`;
		const summary = "E2E opportunity summary";
		const website = "https://example.com/opportunity";
		const content = `E2E opportunity content ${randomUUID()}`;
		const source = await db.getOpportunitySource();

		// Create — item starts in draft state.
		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary(summary);
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.fillDatePicker("End date", 2025, 7, 1);
		await opportunitiesPage.fillWebsite(website);
		await opportunitiesPage.addContentBlock(content);
		await opportunitiesPage.submitForm();

		let opportunity = await db.getOpportunityByTitle(title);
		expect(opportunity).toMatchObject({ sourceId: source.id, summary, website });
		expect(opportunity?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(opportunity?.duration.end).toStrictEqual(new Date("2025-07-01T00:00:00.000Z"));
		let contentBlocks = await db.getOpportunityContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		// List: draft badge visible.
		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.draftBadgeInRow(title)).toBeVisible();
		await expect(opportunitiesPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await opportunitiesPage.gotoDetailsFromList(title);
		await expect(opportunitiesPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await opportunitiesPage.publishItem();

		// List: row reads as published-only right after publish.
		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(opportunitiesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await opportunitiesPage.gotoDetailsFromList(title);
		await expect(opportunitiesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(opportunitiesPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — title change diverges draft from published.
		await opportunitiesPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		const updatedSummary = "Updated E2E opportunity summary";
		const updatedWebsite = "https://example.com/updated-opportunity";
		const updatedContent = `Updated opportunity content ${randomUUID()}`;
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary(updatedSummary);
		await opportunitiesPage.fillDatePicker("Start date", 2026, 8, 2);
		await opportunitiesPage.fillDatePicker("End date", 2026, 9, 2);
		await opportunitiesPage.fillWebsite(updatedWebsite);
		await opportunitiesPage.updateContentBlockText(updatedContent);
		await opportunitiesPage.submitForm();

		opportunity = await db.getOpportunityByTitle(`${title} Edited`);
		expect(opportunity).toMatchObject({
			sourceId: source.id,
			summary: updatedSummary,
			website: updatedWebsite,
		});
		expect(opportunity?.duration.start).toStrictEqual(new Date("2026-08-02T00:00:00.000Z"));
		expect(opportunity?.duration.end).toStrictEqual(new Date("2026-09-02T00:00:00.000Z"));
		contentBlocks = await db.getOpportunityContentBlocksByTitle(`${title} Edited`);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);

		// List: both badges now visible.
		await opportunitiesPage.searchByTitle(`${title} Edited`);
		await expect(opportunitiesPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(opportunitiesPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await opportunitiesPage.gotoDetailsFromList(`${title} Edited`);
		await expect(opportunitiesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await opportunitiesPage.discardDraft();

		// List: only published remains (original title restored).
		await opportunitiesPage.searchByTitle(title);
		await expect(opportunitiesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(opportunitiesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await opportunitiesPage.gotoDetailsFromList(title);
		await expect(opportunitiesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(opportunitiesPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteOpportunitiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);

		const originalTitle = `${opportunitiesPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${opportunitiesPage.workerPrefix} Updated ${randomUUID()}`;
		const originalContent = `Original opportunity content ${randomUUID()}`;
		const updatedContent = `Updated opportunity content ${randomUUID()}`;

		// Create → Publish.
		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(originalTitle);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("Original E2E opportunity summary");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.addContentBlock(originalContent);
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(originalTitle);
		await opportunitiesPage.gotoDetailsFromList(originalTitle);
		await opportunitiesPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await opportunitiesPage.searchByTitle(originalTitle);
		await opportunitiesPage.gotoDetailsFromList(originalTitle);
		await expect(opportunitiesPage.detailsPublishedBadge()).toBeVisible();
		await opportunitiesPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await opportunitiesPage.fillSummary("Updated E2E opportunity summary");
		await opportunitiesPage.updateContentBlockText(updatedContent);
		await opportunitiesPage.submitForm();

		const contentBlocks = await db.getOpportunityContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);

		// Details: "Published with draft changes" with version selector.
		await opportunitiesPage.searchByTitle(updatedTitle);
		await opportunitiesPage.gotoDetailsFromList(updatedTitle);
		await expect(opportunitiesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(opportunitiesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(opportunitiesPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();
		await expect(page.getByText(updatedContent)).toBeVisible();

		// Switch to published tab — original title shown.
		await opportunitiesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(originalContent)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();
		await expect(page.getByText(updatedContent)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await opportunitiesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});

	test("should clear optional opportunity fields", async ({
		page,
		createWebsiteOpportunitiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const opportunitiesPage = createWebsiteOpportunitiesPage(workerIndex);
		const title = `${opportunitiesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await opportunitiesPage.gotoCreate();
		await opportunitiesPage.fillTitle(title);
		await opportunitiesPage.selectFirstSource();
		await opportunitiesPage.fillSummary("Optional opportunity summary");
		await opportunitiesPage.fillDatePicker("Start date", 2025, 6, 1);
		await opportunitiesPage.fillDatePicker("End date", 2025, 7, 1);
		await opportunitiesPage.fillWebsite("https://example.com/opportunity-clear");
		await opportunitiesPage.addContentBlock("Optional opportunity content");
		await opportunitiesPage.submitForm();

		await opportunitiesPage.searchByTitle(title);
		const row = opportunitiesPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await opportunitiesPage.fillSummary("");
		await opportunitiesPage.fillWebsite("");
		await opportunitiesPage.clearDatePicker("End date");
		await opportunitiesPage.removeFirstContentBlock();
		await opportunitiesPage.submitForm();

		const updated = await db.getOpportunityByTitle(title);
		expect(updated?.summary).toBeNull();
		expect(updated?.website).toBeNull();
		expect(updated?.duration.end).toBeUndefined();
		expect(await db.getOpportunityContentBlocksByTitle(title)).toHaveLength(0);
	});
});
