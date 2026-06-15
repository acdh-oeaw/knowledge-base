import { randomUUID } from "node:crypto";

import { withFailureInjection } from "@/e2e/lib/fixtures/failure-injection";
import { expect, test } from "@/e2e/lib/test";

test.describe("persons admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that global prerequisites exist. */
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	test("should create a person", async ({ createAdminPersonsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} Test Person ${randomUUID()}`;
		const sortName = "Person, Test";
		const email = `person-${randomUUID()}@example.com`;
		const orcid = "0000-0002-1825-0097";
		const biography = "E2E test person biography.";

		await personsPage.gotoCreate();

		await personsPage.fillName(name);
		await personsPage.fillSortName(sortName);
		await personsPage.fillEmail(email);
		await personsPage.fillOrcid(orcid);
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography(biography);

		await personsPage.submitForm();

		await personsPage.searchByName(name);
		await expect(personsPage.rowByName(name)).toBeVisible();

		const created = await db.getPersonByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ email, name, orcid, sortName });
		expect(created?.imageId).toBeTruthy();
		expect(JSON.stringify(await db.getPersonBiographyByName(name))).toContain(biography);
	});

	test("should store images inserted in person rich-text biographies as image content blocks", async ({
		createAdminPersonsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);
		const testAsset = await db.getTestAsset();

		const name = `${personsPage.workerPrefix} Rich Text Image ${randomUUID()}`;
		const biographyBeforeImage = "E2E person biography before image.";
		const biographyAfterImage = "E2E person biography after image.";

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Image, Rich Text");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography(biographyBeforeImage);
		await personsPage.insertImageInBiography("E2E Test Asset");
		await personsPage.typeBiographyAfterImage(biographyAfterImage);

		await personsPage.submitForm();

		const blocks = await db.getPersonBiographyContentBlocksByName(name);
		expect(blocks.map((block) => block.type)).toStrictEqual(["rich_text", "image", "rich_text"]);
		expect(JSON.stringify(blocks[0]?.content)).toContain(biographyBeforeImage);
		expect(blocks[1]?.imageId).toBe(testAsset.id);
		expect(JSON.stringify(blocks[2]?.content)).toContain(biographyAfterImage);
	});

	test("should edit all person form fields", async ({ page, createAdminPersonsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const originalName = `${personsPage.workerPrefix} Edit Me ${randomUUID()}`;
		await personsPage.gotoCreate();
		await personsPage.fillName(originalName);
		await personsPage.fillSortName("Me, Edit");
		await personsPage.fillEmail(`edit-${randomUUID()}@example.com`);
		await personsPage.fillOrcid("0000-0002-1825-0097");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography("Description for edit test.");
		await personsPage.submitForm();

		await personsPage.searchByName(originalName);
		const row = personsPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${personsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSortName = "Updated, Person";
		const updatedEmail = `updated-${randomUUID()}@example.com`;
		const updatedOrcid = "0000-0003-1415-9265";
		const updatedBiography = "Updated E2E test person biography.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await personsPage.fillSortName(updatedSortName);
		await personsPage.fillEmail(updatedEmail);
		await personsPage.fillOrcid(updatedOrcid);
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		const biographyEditor = page.getByRole("textbox", { name: "Biography" });
		await biographyEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedBiography);

		await personsPage.submitForm();

		await personsPage.searchByName(updatedName);
		await expect(personsPage.rowByName(updatedName)).toBeVisible();
		await personsPage.searchByName(originalName);
		await expect(personsPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getPersonByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			email: updatedEmail,
			name: updatedName,
			orcid: updatedOrcid,
			sortName: updatedSortName,
		});
		expect(updated?.imageId).toBeTruthy();
		expect(JSON.stringify(await db.getPersonBiographyByName(updatedName))).toContain(
			updatedBiography,
		);
	});

	test("should clear optional person fields", async ({ page, createAdminPersonsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);
		const originalName = `${personsPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await personsPage.gotoCreate();
		await personsPage.fillName(originalName);
		await personsPage.fillSortName("Optional, Clear");
		await personsPage.fillEmail(`clear-${randomUUID()}@example.com`);
		await personsPage.fillOrcid("0000-0002-1825-0097");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography("Required biography for clear test.");
		await personsPage.submitForm();

		await personsPage.searchByName(originalName);
		const row = personsPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${personsPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await personsPage.fillEmail("");
		await personsPage.fillOrcid("");
		await personsPage.removeImage();
		await personsPage.submitForm();

		const updated = await db.getPersonByName(updatedName);
		expect(updated).toMatchObject({ email: null, imageId: null, orcid: null });
	});

	test("failure injection forces createServerAction to return an error state", async ({
		page,
		createAdminPersonsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} FailureInjection ${randomUUID()}`;

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("FailureInjection, Person");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography("Failure injection biography.");

		await withFailureInjection(page, async () => {
			await page.getByRole("button", { name: /^Save(?! and publish\b).*$/ }).click();
			/** Action returns error state; URL stays on the create page. */
			await expect(page).toHaveURL(/\/dashboard\/administrator\/persons\/create$/);
			await expect(page.getByText("Internal server error.")).toBeVisible();
		});

		/** Sanity check: nothing was persisted. */
		await personsPage.goto();
		await personsPage.searchByName(name);
		await expect(personsPage.rowByName(name)).toBeHidden();
	});

	test("should manage contributions", async ({ createAdminPersonsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} Contributions ${randomUUID()}`;
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Contributions, Person");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography("Biography for contribution test.");
		await personsPage.submitForm();

		await personsPage.gotoEditFromList(name);
		await personsPage.goToContributionsTab();

		// Add a contribution.
		await personsPage.selectFirstContributionRole();
		await personsPage.selectFirstContributionOrg();
		await personsPage.fillContributionDatePicker("Start date", 2025, 1, 1);
		await personsPage.submitAddContribution();

		// Verify contribution row appears (header row + 1 data row = 2).
		await expect(personsPage.contributionsTable().getByRole("row")).toHaveCount(2);

		const person = await db.getPersonByName(name);
		const contributions = await db.getContributionsByPersonVersionId(person!.id);
		expect(contributions).toHaveLength(1);
		expect(contributions[0]!.duration.start).toStrictEqual(new Date("2025-01-01T00:00:00.000Z"));
		expect(contributions[0]!.duration.end).toBeUndefined();

		// End the contribution.
		await personsPage.clickEndContribution();
		await personsPage.fillEndContributionDate(2025, 12, 31);
		await personsPage.confirmEndContribution();

		// Verify "End contribution" action is gone and "present" is replaced by a date.
		await personsPage
			.contributionsTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await expect(personsPage.page.getByRole("menuitem", { name: "End contribution" })).toBeHidden();
		await personsPage.page.keyboard.press("Escape");
		await expect(personsPage.contributionsTable().getByText("present")).toBeHidden();

		// Verify end date persisted.
		const updatedContributions = await db.getContributionsByPersonVersionId(person!.id);
		expect(updatedContributions[0]!.duration.end).toBeDefined();
	});

	test("should delete a person", async ({ createAdminPersonsPage }) => {
		const workerIndex = test.info().workerIndex;
		const personsPage = createAdminPersonsPage(workerIndex);

		const name = `${personsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Me, Delete");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.fillBiography("Description for delete test.");
		await personsPage.submitForm();

		await personsPage.searchByName(name);
		await expect(personsPage.rowByName(name)).toBeVisible();

		const deleteDialog = await personsPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await personsPage.confirmDelete(deleteDialog);

		await expect(personsPage.rowByName(name)).toBeHidden();
	});
});
