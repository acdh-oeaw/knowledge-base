import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("countries admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerCountries(testInfo.workerIndex);
	});

	test("should create a country", async ({ createAdminCountriesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const countriesPage = createAdminCountriesPage(workerIndex);

		const name = `${countriesPage.workerPrefix} Test Country ${randomUUID()}`;
		const acronym = "E2EC";
		const summary = "E2E test country summary.";
		const description = "E2E test country description.";
		const testAsset = await db.getTestAsset();

		await countriesPage.gotoCreate();

		await countriesPage.fillName(name);
		await countriesPage.fillAcronym(acronym);
		await countriesPage.fillSummary(summary);
		await countriesPage.selectTestImage();
		await countriesPage.fillDescription(description);

		await countriesPage.submitForm();

		await countriesPage.searchByName(name);
		await expect(countriesPage.rowByName(name)).toBeVisible();

		const created = await db.getCountryByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ acronym, imageId: testAsset.id, name, summary });
		expect(JSON.stringify(await db.getCountryDescriptionByName(name))).toContain(description);
	});

	test("should edit all country form fields", async ({ page, createAdminCountriesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const countriesPage = createAdminCountriesPage(workerIndex);
		const testAsset = await db.getTestAsset();

		const originalName = `${countriesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await countriesPage.gotoCreate();
		await countriesPage.fillName(originalName);
		await countriesPage.fillAcronym("E2ECOLD");
		await countriesPage.fillSummary("E2E test country to be edited.");
		await countriesPage.fillDescription("Description for edit test.");
		await countriesPage.submitForm();

		await countriesPage.searchByName(originalName);
		const row = countriesPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${countriesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedAcronym = "E2ECNEW";
		const updatedSummary = "Updated E2E test country summary.";
		const updatedDescription = "Updated E2E test country description.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await countriesPage.fillAcronym(updatedAcronym);
		await countriesPage.fillSummary(updatedSummary);
		await countriesPage.selectTestImage();
		const descriptionEditor = page.getByRole("textbox", { name: "Description" });
		await descriptionEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedDescription);

		await countriesPage.submitForm();

		await countriesPage.searchByName(updatedName);
		await expect(countriesPage.rowByName(updatedName)).toBeVisible();
		await countriesPage.searchByName(originalName);
		await expect(countriesPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getCountryByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			acronym: updatedAcronym,
			imageId: testAsset.id,
			name: updatedName,
			summary: updatedSummary,
		});
		expect(JSON.stringify(await db.getCountryDescriptionByName(updatedName))).toContain(
			updatedDescription,
		);
	});

	test("should clear optional country fields", async ({ page, createAdminCountriesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const countriesPage = createAdminCountriesPage(workerIndex);
		const originalName = `${countriesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await countriesPage.gotoCreate();
		await countriesPage.fillName(originalName);
		await countriesPage.fillAcronym("E2ECOPT");
		await countriesPage.fillSummary("Optional country summary.");
		await countriesPage.selectTestImage();
		await countriesPage.fillDescription("Required description for clear test.");
		await countriesPage.submitForm();

		await countriesPage.searchByName(originalName);
		const row = countriesPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${countriesPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await countriesPage.fillAcronym("");
		await countriesPage.fillSummary("");
		await countriesPage.removeImage();
		await countriesPage.submitForm();

		const updated = await db.getCountryByName(updatedName);
		expect(updated).toMatchObject({ acronym: null, imageId: null, summary: null });
	});

	test("should delete a country", async ({ createAdminCountriesPage }) => {
		const workerIndex = test.info().workerIndex;
		const countriesPage = createAdminCountriesPage(workerIndex);

		const name = `${countriesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await countriesPage.gotoCreate();
		await countriesPage.fillName(name);
		await countriesPage.fillDescription("Description for delete test.");
		await countriesPage.submitForm();

		await countriesPage.searchByName(name);
		await expect(countriesPage.rowByName(name)).toBeVisible();

		const deleteDialog = await countriesPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await countriesPage.confirmDelete(deleteDialog);

		await expect(countriesPage.rowByName(name)).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminCountriesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const countriesPage = createAdminCountriesPage(workerIndex);

		const name = `${countriesPage.workerPrefix} VersionSelector ${randomUUID()}`;
		const originalSummary = `${countriesPage.workerPrefix} Original summary ${randomUUID()}`;
		const updatedSummary = `${countriesPage.workerPrefix} Updated summary ${randomUUID()}`;

		// Create → Publish. Right after publishing the details page reads as published-only
		// (the cloned draft row exists but has no changes from the published version).
		await countriesPage.gotoCreate();
		await countriesPage.fillName(name);
		await countriesPage.fillSummary(originalSummary);
		await countriesPage.selectTestImage();
		await countriesPage.fillDescription("Version selector test description.");
		await countriesPage.submitForm();

		await countriesPage.searchByName(name);
		await countriesPage.gotoDetailsFromList(name);
		await countriesPage.publishFromDetails();

		// Edit the draft's summary so it diverges from the published version.
		await countriesPage.searchByName(name);
		await countriesPage.gotoDetailsFromList(name);
		await expect(countriesPage.detailsPublishedBadge()).toBeVisible();
		await countriesPage.gotoEditFromDetails();
		await countriesPage.fillSummary(updatedSummary);
		await countriesPage.submitForm();

		// Details: "Published with draft changes" with both version links.
		await countriesPage.searchByName(name);
		await countriesPage.gotoDetailsFromList(name);
		await expect(countriesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(countriesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(countriesPage.versionSelectorPublishedLink()).toBeVisible();

		// Draft tab (default) — updated summary shown.
		await expect(page.getByText(updatedSummary)).toBeVisible();

		// Switch to the published tab — original summary shown, updated hidden. This is the assertion
		// that guards against the details page rendering draft scalars under the published version.
		await countriesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalSummary)).toBeVisible();
		await expect(page.getByText(updatedSummary)).toBeHidden();

		// Switch back to the draft tab — updated summary shown again.
		await countriesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedSummary)).toBeVisible();
	});
});
