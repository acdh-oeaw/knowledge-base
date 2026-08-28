import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website events lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerEventsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({ page, createWebsiteEventsPage }) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);

		const title = `${eventsPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(title);
		await eventsPage.fillSummary("Lifecycle test event summary");
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.submitForm();

		// List: draft badge visible.
		await eventsPage.searchByTitle(title);
		await expect(eventsPage.draftBadgeInRow(title)).toBeVisible();
		await expect(eventsPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await eventsPage.gotoDetailsFromList(title);
		await expect(eventsPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await eventsPage.publishItem();

		// List: row reads as published-only right after publish.
		await eventsPage.searchByTitle(title);
		await expect(eventsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(eventsPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await eventsPage.gotoDetailsFromList(title);
		await expect(eventsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(eventsPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await eventsPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		await eventsPage.submitForm();

		// List: both badges now visible.
		await eventsPage.searchByTitle(`${title} Edited`);
		await expect(eventsPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(eventsPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await eventsPage.gotoDetailsFromList(`${title} Edited`);
		await expect(eventsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await eventsPage.discardDraft();

		// List: only published remains (original title restored).
		await eventsPage.searchByTitle(title);
		await expect(eventsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(eventsPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await eventsPage.gotoDetailsFromList(title);
		await expect(eventsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(eventsPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteEventsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);

		const originalTitle = `${eventsPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${eventsPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(originalTitle);
		await eventsPage.fillSummary("Version selector test event");
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(originalTitle);
		await eventsPage.gotoDetailsFromList(originalTitle);
		await eventsPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await eventsPage.searchByTitle(originalTitle);
		await eventsPage.gotoDetailsFromList(originalTitle);
		await expect(eventsPage.detailsPublishedBadge()).toBeVisible();
		await eventsPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await eventsPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await eventsPage.searchByTitle(updatedTitle);
		await eventsPage.gotoDetailsFromList(updatedTitle);
		await expect(eventsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(eventsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(eventsPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await eventsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await eventsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
