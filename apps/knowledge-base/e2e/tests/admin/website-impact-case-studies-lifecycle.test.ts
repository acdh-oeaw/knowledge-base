import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website impact case studies lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerImpactCaseStudiesLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const title = `${impactPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await impactPage.gotoCreate();
		await impactPage.fillTitle(title);
		await impactPage.fillSummary("Lifecycle test impact case study summary");
		await impactPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactPage.submitForm();

		// List: draft badge visible.
		await impactPage.searchByTitle(title);
		await expect(impactPage.draftBadgeInRow(title)).toBeVisible();
		await expect(impactPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await impactPage.gotoDetailsFromList(title);
		await expect(impactPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await impactPage.publishItem();

		// List: row reads as published-only right after publish.
		await impactPage.searchByTitle(title);
		await expect(impactPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(impactPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await impactPage.gotoDetailsFromList(title);
		await expect(impactPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(impactPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await impactPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		await impactPage.submitForm();

		// List: both badges now visible.
		await impactPage.searchByTitle(`${title} Edited`);
		await expect(impactPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(impactPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await impactPage.gotoDetailsFromList(`${title} Edited`);
		await expect(impactPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await impactPage.discardDraft();

		// List: only published remains (original title restored).
		await impactPage.searchByTitle(title);
		await expect(impactPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(impactPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await impactPage.gotoDetailsFromList(title);
		await expect(impactPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(impactPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const originalTitle = `${impactPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${impactPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await impactPage.gotoCreate();
		await impactPage.fillTitle(originalTitle);
		await impactPage.fillSummary("Version selector test impact case study");
		await impactPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactPage.submitForm();

		await impactPage.searchByTitle(originalTitle);
		await impactPage.gotoDetailsFromList(originalTitle);
		await impactPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await impactPage.searchByTitle(originalTitle);
		await impactPage.gotoDetailsFromList(originalTitle);
		await expect(impactPage.detailsPublishedBadge()).toBeVisible();
		await impactPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await impactPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await impactPage.searchByTitle(updatedTitle);
		await impactPage.gotoDetailsFromList(updatedTitle);
		await expect(impactPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(impactPage.versionSelectorDraftLink()).toBeVisible();
		await expect(impactPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await impactPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await impactPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
