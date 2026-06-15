import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website funding calls lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerFundingCallsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		page,
		createWebsiteFundingCallsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const title = `${fundingCallsPage.workerPrefix} Lifecycle ${randomUUID()}`;
		const summary = "E2E funding call summary";
		const content = `E2E funding call content ${randomUUID()}`;

		// Create — item starts in draft state.
		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary(summary);
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.fillDatePicker("End date", 2025, 7, 1);
		await fundingCallsPage.addContentBlock(content);
		await fundingCallsPage.submitForm();

		let fundingCall = await db.getFundingCallByTitle(title);
		expect(fundingCall).toMatchObject({ summary });
		expect(fundingCall?.duration.start).toStrictEqual(new Date("2025-06-01T00:00:00.000Z"));
		expect(fundingCall?.duration.end).toStrictEqual(new Date("2025-07-01T00:00:00.000Z"));
		let contentBlocks = await db.getFundingCallContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		// List: draft badge visible.
		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.draftBadgeInRow(title)).toBeVisible();
		await expect(fundingCallsPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await fundingCallsPage.gotoDetailsFromList(title);
		await expect(fundingCallsPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await fundingCallsPage.publishItem();

		// List: row reads as published-only right after publish.
		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(fundingCallsPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await fundingCallsPage.gotoDetailsFromList(title);
		await expect(fundingCallsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(fundingCallsPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — title change diverges draft from published.
		await fundingCallsPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		const updatedSummary = "Updated E2E funding call summary";
		const updatedContent = `Updated funding call content ${randomUUID()}`;
		await fundingCallsPage.fillSummary(updatedSummary);
		await fundingCallsPage.fillDatePicker("Start date", 2026, 8, 2);
		await fundingCallsPage.fillDatePicker("End date", 2026, 9, 2);
		await fundingCallsPage.updateContentBlockText(updatedContent);
		await fundingCallsPage.submitForm();

		fundingCall = await db.getFundingCallByTitle(`${title} Edited`);
		expect(fundingCall).toMatchObject({ summary: updatedSummary });
		expect(fundingCall?.duration.start).toStrictEqual(new Date("2026-08-02T00:00:00.000Z"));
		expect(fundingCall?.duration.end).toStrictEqual(new Date("2026-09-02T00:00:00.000Z"));
		contentBlocks = await db.getFundingCallContentBlocksByTitle(`${title} Edited`);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);

		// List: both badges now visible.
		await fundingCallsPage.searchByTitle(`${title} Edited`);
		await expect(fundingCallsPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(fundingCallsPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await fundingCallsPage.gotoDetailsFromList(`${title} Edited`);
		await expect(fundingCallsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await fundingCallsPage.discardDraft();

		// List: only published remains (original title restored).
		await fundingCallsPage.searchByTitle(title);
		await expect(fundingCallsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(fundingCallsPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await fundingCallsPage.gotoDetailsFromList(title);
		await expect(fundingCallsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(fundingCallsPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteFundingCallsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);

		const originalTitle = `${fundingCallsPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${fundingCallsPage.workerPrefix} Updated ${randomUUID()}`;
		const originalContent = `Original funding call content ${randomUUID()}`;
		const updatedContent = `Updated funding call content ${randomUUID()}`;

		// Create → Publish.
		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(originalTitle);
		await fundingCallsPage.fillSummary("Original E2E funding call summary");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.addContentBlock(originalContent);
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(originalTitle);
		await fundingCallsPage.gotoDetailsFromList(originalTitle);
		await fundingCallsPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await fundingCallsPage.searchByTitle(originalTitle);
		await fundingCallsPage.gotoDetailsFromList(originalTitle);
		await expect(fundingCallsPage.detailsPublishedBadge()).toBeVisible();
		await fundingCallsPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await fundingCallsPage.fillSummary("Updated E2E funding call summary");
		await fundingCallsPage.updateContentBlockText(updatedContent);
		await fundingCallsPage.submitForm();

		const contentBlocks = await db.getFundingCallContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);

		// Details: "Published with draft changes" with version selector.
		await fundingCallsPage.searchByTitle(updatedTitle);
		await fundingCallsPage.gotoDetailsFromList(updatedTitle);
		await expect(fundingCallsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(fundingCallsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(fundingCallsPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();
		await expect(page.getByText(updatedContent)).toBeVisible();

		// Switch to published tab — original title shown.
		await fundingCallsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(originalContent)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();
		await expect(page.getByText(updatedContent)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await fundingCallsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});

	test("should clear optional funding call fields", async ({
		page,
		createWebsiteFundingCallsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const fundingCallsPage = createWebsiteFundingCallsPage(workerIndex);
		const title = `${fundingCallsPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await fundingCallsPage.gotoCreate();
		await fundingCallsPage.fillTitle(title);
		await fundingCallsPage.fillSummary("Optional funding call summary");
		await fundingCallsPage.fillDatePicker("Start date", 2025, 6, 1);
		await fundingCallsPage.fillDatePicker("End date", 2025, 7, 1);
		await fundingCallsPage.addContentBlock("Optional funding call content");
		await fundingCallsPage.submitForm();

		await fundingCallsPage.searchByTitle(title);
		const row = fundingCallsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await fundingCallsPage.fillSummary("");
		await fundingCallsPage.clearDatePicker("End date");
		await fundingCallsPage.removeFirstContentBlock();
		await fundingCallsPage.submitForm();

		const updated = await db.getFundingCallByTitle(title);
		expect(updated?.summary).toBeNull();
		expect(updated?.duration.end).toBeUndefined();
		expect(await db.getFundingCallContentBlocksByTitle(title)).toHaveLength(0);
	});
});
