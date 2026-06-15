import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website news lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerNewsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → discard draft", async ({ page, createWebsiteNewsPage }) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);

		const title = `${newsPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await newsPage.gotoCreate();
		await newsPage.fillTitle(title);
		await newsPage.fillSummary("Lifecycle test summary");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.submitForm();

		// List: draft badge visible.
		await newsPage.searchByTitle(title);
		await expect(newsPage.draftBadgeInRow(title)).toBeVisible();

		// Details: "Draft" badge, Publish button, no Discard button.
		await newsPage.gotoDetailsFromList(title);
		await expect(newsPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await newsPage.publishItem();

		// List: hasDraft is computed via "draft updated_at > published updated_at" and is false right
		// after publish (publishVersion sets them equal), so the row reads as published-only.
		await newsPage.searchByTitle(title);
		await expect(newsPage.publishedBadgeInRow(title)).toBeVisible();

		// Details: the cloned draft row exists but is identical to published, so the bar treats this
		// as a clean published-only state — "Published" badge, no Discard, no version selector.
		await newsPage.gotoDetailsFromList(title);
		await expect(newsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeHidden();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(newsPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft so it diverges from published.
		await newsPage.gotoEditFromDetails();
		const summaryField = page.getByLabel("Summary");
		await summaryField.clear();
		await summaryField.fill("Lifecycle test summary — edited");
		await newsPage.submitForm();

		// List: both badges now visible (draft is newer than published).
		await newsPage.searchByTitle(title);
		await expect(newsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(newsPage.draftBadgeInRow(title)).toBeVisible();

		// Details: now "Published with draft changes" + Publish + Discard.
		await newsPage.gotoDetailsFromList(title);
		await expect(newsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await newsPage.discardDraft();

		// List: only published remains.
		await newsPage.searchByTitle(title);
		await expect(newsPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(newsPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await newsPage.gotoDetailsFromList(title);
		await expect(newsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeHidden();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(newsPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteNewsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const newsPage = createWebsiteNewsPage(workerIndex);

		const originalTitle = `${newsPage.workerPrefix} Version A ${randomUUID()}`;

		// Create → Publish. The post-publish state already reads as published-only on the details
		// page (the cloned draft row exists but has no changes from published).
		await newsPage.gotoCreate();
		await newsPage.fillTitle(originalTitle);
		await newsPage.fillSummary("Version selector test");
		await newsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await newsPage.submitForm();

		await newsPage.searchByTitle(originalTitle);
		await newsPage.gotoDetailsFromList(originalTitle);
		await newsPage.publishItem();

		// From the published-only details page, click Edit.
		await newsPage.searchByTitle(originalTitle);
		await newsPage.gotoDetailsFromList(originalTitle);
		await expect(newsPage.detailsPublishedBadge()).toBeVisible();
		await newsPage.gotoEditFromDetails();

		// Update the title.
		const updatedTitle = `${newsPage.workerPrefix} Version B ${randomUUID()}`;
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await newsPage.submitForm();

		// List: row appears under updated title with separate "Published" and "Draft" badges.
		await newsPage.searchByTitle(updatedTitle);
		await expect(newsPage.publishedBadgeInRow(updatedTitle)).toBeVisible();
		await expect(newsPage.draftBadgeInRow(updatedTitle)).toBeVisible();

		// Details: "Published with draft changes" — draft has new title, published has original.
		await newsPage.gotoDetailsFromList(updatedTitle);
		await expect(newsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();

		// Version selector is visible with both tabs.
		await expect(newsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(newsPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await newsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await newsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
