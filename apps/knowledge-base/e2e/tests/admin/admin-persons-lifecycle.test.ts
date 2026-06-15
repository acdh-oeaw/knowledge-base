import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("persons admin lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPersonsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({ page, createAdminPersonsPage }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Lifecycle, Person");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.submitForm();

		// List: draft badge visible.
		await personsPage.searchByName(name);
		await expect(personsPage.draftBadgeInRow(name)).toBeVisible();
		await expect(personsPage.publishedBadgeInRow(name)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await personsPage.publishItem();

		// List: hasDraft is computed via "draft updated_at > published updated_at" and is false
		// right after publish (publishVersion sets them equal), so the row reads as published-only.
		await personsPage.searchByName(name);
		await expect(personsPage.publishedBadgeInRow(name)).toBeVisible();
		await expect(personsPage.draftBadgeInRow(name)).toBeHidden();

		// Details: the draft row still exists but is identical to published, so the bar should treat
		// this as a clean published-only state — "Published" badge, no Discard, no version selector.
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(personsPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await personsPage.gotoEditFromDetails();
		const sortNameField = page.getByLabel("Sort name");
		await sortNameField.clear();
		await sortNameField.fill("Lifecycle, Edited");
		await personsPage.submitForm();

		// List: both badges now visible (draft is newer than published).
		await personsPage.searchByName(name);
		await expect(personsPage.publishedBadgeInRow(name)).toBeVisible();
		await expect(personsPage.draftBadgeInRow(name)).toBeVisible();

		// Details: now "Published with draft changes" + Discard + version selector.
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await personsPage.discardDraft();

		// List: only published remains.
		await personsPage.searchByName(name);
		await expect(personsPage.publishedBadgeInRow(name)).toBeVisible();
		await expect(personsPage.draftBadgeInRow(name)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(personsPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("contributions are cloned to published version", async ({ createAdminPersonsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} Publish Contributions ${randomUUID()}`;
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Contributions, Publish");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.submitForm();

		// Add a contribution on the draft.
		await personsPage.gotoEditFromList(name);
		await personsPage.goToContributionsTab();
		await personsPage.selectFirstContributionRole();
		await personsPage.selectFirstContributionOrg();
		await personsPage.fillContributionDatePicker("Start date", 2025, 1, 1);
		await personsPage.submitAddContribution();

		// Verify draft has the contribution.
		const person = await db.getPersonByName(name);
		expect(await db.getContributionsByPersonVersionId(person!.id)).toHaveLength(1);

		// Publish.
		await personsPage.goto();
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.publishItem();

		// Verify the contribution is present on the published version.
		const publishedId = await db.getPublishedVersionId(person!.documentId);
		expect(publishedId).not.toBeNull();
		expect(await db.getContributionsByPersonVersionId(publishedId!)).toHaveLength(1);
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminPersonsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const originalSortName = `${personsPage.workerPrefix} Original ${randomUUID()}`;
		const updatedSortName = `${personsPage.workerPrefix} Updated ${randomUUID()}`;
		const name = `${personsPage.workerPrefix} VersionSelector ${randomUUID()}`;

		// Create → Publish. The post-publish state already reads as published-only on the details
		// page (the cloned draft row exists but has no changes from published).
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName(originalSortName);
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.submitForm();

		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.publishItem();

		// From the published-only details page, click Edit and update sort name.
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsPublishedBadge()).toBeVisible();
		await personsPage.gotoEditFromDetails();

		const sortNameField = page.getByLabel("Sort name");
		await sortNameField.clear();
		await sortNameField.fill(updatedSortName);
		await personsPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await expect(personsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(personsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(personsPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated sort name shown.
		await expect(page.getByText(updatedSortName)).toBeVisible();

		// Switch to published tab — original sort name shown.
		await personsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalSortName)).toBeVisible();
		await expect(page.getByText(updatedSortName)).toBeHidden();

		// Switch back to draft tab — updated sort name shown again.
		await personsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedSortName)).toBeVisible();
	});
});
