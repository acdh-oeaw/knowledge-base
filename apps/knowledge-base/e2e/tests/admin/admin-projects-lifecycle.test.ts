import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("admin projects lifecycle", () => {
	test.describe.configure({ mode: "default" });

	const campaignIds: Array<string> = [];

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		for (const campaignId of campaignIds) {
			await db.deleteReportingCampaign(campaignId);
		}
		await db.cleanupWorkerProjectsLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({ page, createAdminProjectsPage }) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);

		const name = `${projectsPage.workerPrefix} Lifecycle ${randomUUID()}`;

		// Create — item starts in draft state.
		await projectsPage.gotoCreate();
		await projectsPage.fillName(name);
		await projectsPage.selectFirstScope();
		await projectsPage.fillDatePicker("Start date", 2025, 1, 15);
		await projectsPage.fillSummary("Lifecycle test project summary");
		await projectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await projectsPage.submitForm();

		// List: draft badge visible.
		await projectsPage.searchByName(name);
		await expect(projectsPage.draftBadgeInRow(name)).toBeVisible();
		await expect(projectsPage.publishedBadgeInRow(name)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await projectsPage.gotoDetailsFromList(name);
		await expect(projectsPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await projectsPage.publishItem();

		// List: hasDraft is computed via "draft updated_at > published updated_at" and is false
		// right after publish (publishVersion sets them equal), so the row reads as published-only.
		await projectsPage.searchByName(name);
		await expect(projectsPage.publishedBadgeInRow(name)).toBeVisible();
		await expect(projectsPage.draftBadgeInRow(name)).toBeHidden();

		// Details: the draft row still exists but is identical to published, so the bar should treat
		// this as a clean published-only state — "Published" badge, no Discard, no version selector.
		await projectsPage.gotoDetailsFromList(name);
		await expect(projectsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(projectsPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await projectsPage.gotoEditFromDetails();
		const nameField = page.getByRole("main").getByLabel("Name");
		await nameField.clear();
		await nameField.fill(`${name} Edited`);
		await projectsPage.submitForm();

		// List: both badges now visible (draft is newer than published).
		await projectsPage.searchByName(`${name} Edited`);
		await expect(projectsPage.publishedBadgeInRow(`${name} Edited`)).toBeVisible();
		await expect(projectsPage.draftBadgeInRow(`${name} Edited`)).toBeVisible();

		// Details: now "Published with draft changes" + Discard + version selector.
		await projectsPage.gotoDetailsFromList(`${name} Edited`);
		await expect(projectsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await projectsPage.discardDraft();

		// List: only published remains (original name restored).
		await projectsPage.searchByName(name);
		await expect(projectsPage.publishedBadgeInRow(name)).toBeVisible();
		await expect(projectsPage.draftBadgeInRow(name)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await projectsPage.gotoDetailsFromList(name);
		await expect(projectsPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(projectsPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminProjectsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);

		const originalName = `${projectsPage.workerPrefix} Original ${randomUUID()}`;
		const updatedName = `${projectsPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await projectsPage.gotoCreate();
		await projectsPage.fillName(originalName);
		await projectsPage.selectFirstScope();
		await projectsPage.fillDatePicker("Start date", 2025, 1, 15);
		await projectsPage.fillSummary("Version selector test project");
		await projectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await projectsPage.submitForm();

		await projectsPage.searchByName(originalName);
		await projectsPage.gotoDetailsFromList(originalName);
		await projectsPage.publishItem();

		// From the published-only details page, click Edit and update the name.
		await projectsPage.searchByName(originalName);
		await projectsPage.gotoDetailsFromList(originalName);
		await expect(projectsPage.detailsPublishedBadge()).toBeVisible();
		await projectsPage.gotoEditFromDetails();

		const nameField = page.getByRole("main").getByLabel("Name");
		await nameField.clear();
		await nameField.fill(updatedName);
		await projectsPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await projectsPage.searchByName(updatedName);
		await projectsPage.gotoDetailsFromList(updatedName);
		await expect(projectsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(projectsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(projectsPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated name shown.
		await expect(page.getByText(updatedName)).toBeVisible();

		// Switch to published tab — original name shown.
		await projectsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalName)).toBeVisible();
		await expect(page.getByText(updatedName)).toBeHidden();

		// Switch back to draft tab — updated name shown again.
		await projectsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedName)).toBeVisible();
	});

	test("re-publish keeps country report contribution linked to the project (document-level)", async ({
		page,
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const projectsPage = createAdminProjectsPage(workerIndex);

		const originalName = `${projectsPage.workerPrefix} Reported ${randomUUID()}`;
		const updatedName = `${projectsPage.workerPrefix} Reported Updated ${randomUUID()}`;
		const year = 3100 + workerIndex;

		await projectsPage.gotoCreate();
		await projectsPage.fillName(originalName);
		await projectsPage.selectFirstScope();
		await projectsPage.fillDatePicker("Start date", 2025, 1, 15);
		await projectsPage.fillSummary("Reported project lifecycle test");
		await projectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await projectsPage.submitForm();

		await projectsPage.searchByName(originalName);
		await projectsPage.gotoDetailsFromList(originalName);
		await projectsPage.publishItem();

		const publishedProject = await db.getProjectByName(originalName);
		expect(publishedProject).not.toBeNull();

		const campaign = await db.createOpenCampaign(year);
		campaignIds.push(campaign.id);
		const country = await db.getCountryOption();
		const report = await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
		});
		// Contributions reference the project by its document id, so the link must survive re-publish
		// regardless of whether the published version id changes.
		await db.createCountryReportProjectContribution({
			amountEuros: 1234,
			countryReportId: report.id,
			projectDocumentId: publishedProject!.documentId,
		});

		await projectsPage.searchByName(originalName);
		await projectsPage.gotoDetailsFromList(originalName);
		await projectsPage.gotoEditFromDetails();
		const nameField = page.getByRole("main").getByLabel("Name");
		await nameField.clear();
		await nameField.fill(updatedName);
		await projectsPage.submitForm();

		await projectsPage.searchByName(updatedName);
		await projectsPage.gotoDetailsFromList(updatedName);
		await projectsPage.publishItem();

		// Same logical project (stable document id) even though re-publishing may mint a new version id.
		const republishedProject = await db.getProjectByName(updatedName);
		expect(republishedProject).toMatchObject({ documentId: publishedProject!.documentId });
		await expect(async () => {
			const contribution = await db.getCountryReportProjectContributionByProjectDocumentId(
				publishedProject!.documentId,
			);
			expect(contribution).toMatchObject({
				amountEuros: 1234,
				countryReportId: report.id,
				projectDocumentId: publishedProject!.documentId,
			});
		}).toPass({ timeout: 10_000 });
	});
});
