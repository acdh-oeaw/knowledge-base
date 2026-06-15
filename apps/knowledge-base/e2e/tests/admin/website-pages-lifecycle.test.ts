import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website pages lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPageItemsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({ page, createWebsitePagesPage }) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const title = `${pagesPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await pagesPage.gotoCreate();
		await pagesPage.fillTitle(title);
		await pagesPage.fillSummary("Lifecycle test page summary");
		await pagesPage.submitForm();

		// List: draft badge visible.
		await pagesPage.searchByTitle(title);
		await expect(pagesPage.draftBadgeInRow(title)).toBeVisible();
		await expect(pagesPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await pagesPage.gotoDetailsFromList(title);
		await expect(pagesPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await pagesPage.publishItem();

		// List: row reads as published-only right after publish.
		await pagesPage.searchByTitle(title);
		await expect(pagesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(pagesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await pagesPage.gotoDetailsFromList(title);
		await expect(pagesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(pagesPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await pagesPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		await pagesPage.submitForm();

		// List: both badges now visible.
		await pagesPage.searchByTitle(`${title} Edited`);
		await expect(pagesPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(pagesPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await pagesPage.gotoDetailsFromList(`${title} Edited`);
		await expect(pagesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await pagesPage.discardDraft();

		// List: only published remains (original title restored).
		await pagesPage.searchByTitle(title);
		await expect(pagesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(pagesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await pagesPage.gotoDetailsFromList(title);
		await expect(pagesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(pagesPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsitePagesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const pagesPage = createWebsitePagesPage(workerIndex);

		const originalTitle = `${pagesPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${pagesPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await pagesPage.gotoCreate();
		await pagesPage.fillTitle(originalTitle);
		await pagesPage.fillSummary("Version selector test page");
		await pagesPage.submitForm();

		await pagesPage.searchByTitle(originalTitle);
		await pagesPage.gotoDetailsFromList(originalTitle);
		await pagesPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await pagesPage.searchByTitle(originalTitle);
		await pagesPage.gotoDetailsFromList(originalTitle);
		await expect(pagesPage.detailsPublishedBadge()).toBeVisible();
		await pagesPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await pagesPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await pagesPage.searchByTitle(updatedTitle);
		await pagesPage.gotoDetailsFromList(updatedTitle);
		await expect(pagesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(pagesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(pagesPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await pagesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await pagesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
