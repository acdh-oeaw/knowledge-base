import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("national consortia admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerNationalConsortiа(testInfo.workerIndex);
	});

	test("should create a national consortium", async ({ createAdminNationalConsortiaPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const nationalConsortiaPage = createAdminNationalConsortiaPage(workerIndex);

		const name = `${nationalConsortiaPage.workerPrefix} Test NC ${randomUUID()}`;
		const acronym = "E2ENC";
		const ror = "https://ror.org/05n09v162";
		const sshocMarketplaceActorId = 234561;
		const summary = "E2E test national consortium summary.";
		const description = "E2E test national consortium description.";
		const testAsset = await db.getTestAsset();

		await nationalConsortiaPage.gotoCreate();

		await nationalConsortiaPage.fillName(name);
		await nationalConsortiaPage.fillAcronym(acronym);
		await nationalConsortiaPage.fillRor(ror);
		await nationalConsortiaPage.fillSshocMarketplaceActorId(sshocMarketplaceActorId);
		await nationalConsortiaPage.fillSummary(summary);
		await nationalConsortiaPage.selectTestImage();
		await nationalConsortiaPage.fillDescription(description);

		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(name);
		await expect(nationalConsortiaPage.rowByName(name)).toBeVisible();

		const created = await db.getNationalConsortiumByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({
			acronym,
			imageId: testAsset.id,
			name,
			ror,
			sshocMarketplaceActorId,
			summary,
		});
		expect(JSON.stringify(await db.getNationalConsortiumDescriptionByName(name))).toContain(
			description,
		);
	});

	test("should edit all national consortium form fields", async ({
		page,
		createAdminNationalConsortiaPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const nationalConsortiaPage = createAdminNationalConsortiaPage(workerIndex);
		const testAsset = await db.getTestAsset();

		const originalName = `${nationalConsortiaPage.workerPrefix} Edit Me ${randomUUID()}`;
		await nationalConsortiaPage.gotoCreate();
		await nationalConsortiaPage.fillName(originalName);
		await nationalConsortiaPage.fillAcronym("E2ENCOLD");
		await nationalConsortiaPage.fillRor("https://ror.org/05n09v162");
		await nationalConsortiaPage.fillSshocMarketplaceActorId(234562);
		await nationalConsortiaPage.fillSummary("E2E test national consortium to be edited.");
		await nationalConsortiaPage.fillDescription("Description for edit test.");
		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(originalName);
		const row = nationalConsortiaPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${nationalConsortiaPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedAcronym = "E2ENCNEW";
		const updatedRor = "https://ror.org/0abcdef12";
		const updatedSshocMarketplaceActorId = 234563;
		const updatedSummary = "Updated E2E test national consortium summary.";
		const updatedDescription = "Updated E2E test national consortium description.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await nationalConsortiaPage.fillAcronym(updatedAcronym);
		await nationalConsortiaPage.fillRor(updatedRor);
		await nationalConsortiaPage.fillSshocMarketplaceActorId(updatedSshocMarketplaceActorId);
		await nationalConsortiaPage.fillSummary(updatedSummary);
		await nationalConsortiaPage.selectTestImage();
		const descriptionEditor = page.getByRole("textbox", { name: "Description" });
		await descriptionEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedDescription);

		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(updatedName);
		await expect(nationalConsortiaPage.rowByName(updatedName)).toBeVisible();
		await nationalConsortiaPage.searchByName(originalName);
		await expect(nationalConsortiaPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getNationalConsortiumByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			acronym: updatedAcronym,
			imageId: testAsset.id,
			name: updatedName,
			ror: updatedRor,
			sshocMarketplaceActorId: updatedSshocMarketplaceActorId,
			summary: updatedSummary,
		});
		expect(JSON.stringify(await db.getNationalConsortiumDescriptionByName(updatedName))).toContain(
			updatedDescription,
		);
	});

	test("should clear optional national consortium fields", async ({
		page,
		createAdminNationalConsortiaPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const nationalConsortiaPage = createAdminNationalConsortiaPage(workerIndex);
		const originalName = `${nationalConsortiaPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await nationalConsortiaPage.gotoCreate();
		await nationalConsortiaPage.fillName(originalName);
		await nationalConsortiaPage.fillAcronym("E2ENCOPT");
		await nationalConsortiaPage.fillRor("https://ror.org/05n09v162");
		await nationalConsortiaPage.fillSshocMarketplaceActorId(234564);
		await nationalConsortiaPage.fillSummary("Optional national consortium summary.");
		await nationalConsortiaPage.selectTestImage();
		await nationalConsortiaPage.fillDescription("Required description for clear test.");
		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(originalName);
		const row = nationalConsortiaPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${nationalConsortiaPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await nationalConsortiaPage.fillAcronym("");
		await nationalConsortiaPage.fillRor("");
		await page.locator('input[name="sshocMarketplaceActorId"]').fill("");
		await nationalConsortiaPage.fillSummary("");
		await nationalConsortiaPage.removeImage();
		await nationalConsortiaPage.submitForm();

		const updated = await db.getNationalConsortiumByName(updatedName);
		expect(updated).toMatchObject({
			acronym: null,
			imageId: null,
			ror: null,
			sshocMarketplaceActorId: null,
			summary: null,
		});
	});

	test("should delete a national consortium", async ({ createAdminNationalConsortiaPage }) => {
		const workerIndex = test.info().workerIndex;
		const nationalConsortiaPage = createAdminNationalConsortiaPage(workerIndex);

		const name = `${nationalConsortiaPage.workerPrefix} Delete Me ${randomUUID()}`;
		await nationalConsortiaPage.gotoCreate();
		await nationalConsortiaPage.fillName(name);
		await nationalConsortiaPage.fillDescription("Description for delete test.");
		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(name);
		await expect(nationalConsortiaPage.rowByName(name)).toBeVisible();

		const deleteDialog = await nationalConsortiaPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await nationalConsortiaPage.confirmDelete(deleteDialog);

		await expect(nationalConsortiaPage.rowByName(name)).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminNationalConsortiaPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const nationalConsortiaPage = createAdminNationalConsortiaPage(workerIndex);

		const name = `${nationalConsortiaPage.workerPrefix} VersionSelector ${randomUUID()}`;
		const originalSummary = `${nationalConsortiaPage.workerPrefix} Original summary ${randomUUID()}`;
		const updatedSummary = `${nationalConsortiaPage.workerPrefix} Updated summary ${randomUUID()}`;

		// Create → Publish. Right after publishing the details page reads as published-only
		// (the cloned draft row exists but has no changes from the published version).
		await nationalConsortiaPage.gotoCreate();
		await nationalConsortiaPage.fillName(name);
		await nationalConsortiaPage.fillSummary(originalSummary);
		await nationalConsortiaPage.selectTestImage();
		await nationalConsortiaPage.fillDescription("Version selector test description.");
		await nationalConsortiaPage.submitForm();

		await nationalConsortiaPage.searchByName(name);
		await nationalConsortiaPage.gotoDetailsFromList(name);
		await nationalConsortiaPage.publishFromDetails();

		// Edit the draft's summary so it diverges from the published version.
		await nationalConsortiaPage.searchByName(name);
		await nationalConsortiaPage.gotoDetailsFromList(name);
		await expect(nationalConsortiaPage.detailsPublishedBadge()).toBeVisible();
		await nationalConsortiaPage.gotoEditFromDetails();
		await nationalConsortiaPage.fillSummary(updatedSummary);
		await nationalConsortiaPage.submitForm();

		// Details: "Published with draft changes" with both version links.
		await nationalConsortiaPage.searchByName(name);
		await nationalConsortiaPage.gotoDetailsFromList(name);
		await expect(nationalConsortiaPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(nationalConsortiaPage.versionSelectorDraftLink()).toBeVisible();
		await expect(nationalConsortiaPage.versionSelectorPublishedLink()).toBeVisible();

		// Draft tab (default) — updated summary shown.
		await expect(page.getByText(updatedSummary)).toBeVisible();

		// Switch to the published tab — original summary shown, updated hidden. This is the assertion
		// that guards against the details page rendering draft scalars under the published version.
		await nationalConsortiaPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalSummary)).toBeVisible();
		await expect(page.getByText(updatedSummary)).toBeHidden();

		// Switch back to the draft tab — updated summary shown again.
		await nationalConsortiaPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedSummary)).toBeVisible();
	});
});
