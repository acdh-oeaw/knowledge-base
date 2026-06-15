import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website spotlight articles lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerSpotlightArticlesLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		page,
		createWebsiteSpotlightArticlesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await spotlightPage.gotoCreate();
		await spotlightPage.fillTitle(title);
		await spotlightPage.fillSummary("Lifecycle test spotlight article summary");
		await spotlightPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightPage.submitForm();

		// List: draft badge visible.
		await spotlightPage.searchByTitle(title);
		await expect(spotlightPage.draftBadgeInRow(title)).toBeVisible();
		await expect(spotlightPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await spotlightPage.gotoDetailsFromList(title);
		await expect(spotlightPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await spotlightPage.publishItem();

		// List: row reads as published-only right after publish.
		await spotlightPage.searchByTitle(title);
		await expect(spotlightPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(spotlightPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await spotlightPage.gotoDetailsFromList(title);
		await expect(spotlightPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(spotlightPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await spotlightPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		await spotlightPage.submitForm();

		// List: both badges now visible.
		await spotlightPage.searchByTitle(`${title} Edited`);
		await expect(spotlightPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(spotlightPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await spotlightPage.gotoDetailsFromList(`${title} Edited`);
		await expect(spotlightPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await spotlightPage.discardDraft();

		// List: only published remains (original title restored).
		await spotlightPage.searchByTitle(title);
		await expect(spotlightPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(spotlightPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await spotlightPage.gotoDetailsFromList(title);
		await expect(spotlightPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(spotlightPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteSpotlightArticlesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const originalTitle = `${spotlightPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${spotlightPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await spotlightPage.gotoCreate();
		await spotlightPage.fillTitle(originalTitle);
		await spotlightPage.fillSummary("Version selector test spotlight article");
		await spotlightPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightPage.submitForm();

		await spotlightPage.searchByTitle(originalTitle);
		await spotlightPage.gotoDetailsFromList(originalTitle);
		await spotlightPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await spotlightPage.searchByTitle(originalTitle);
		await spotlightPage.gotoDetailsFromList(originalTitle);
		await expect(spotlightPage.detailsPublishedBadge()).toBeVisible();
		await spotlightPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await spotlightPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await spotlightPage.searchByTitle(updatedTitle);
		await spotlightPage.gotoDetailsFromList(updatedTitle);
		await expect(spotlightPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(spotlightPage.versionSelectorDraftLink()).toBeVisible();
		await expect(spotlightPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await spotlightPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await spotlightPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
