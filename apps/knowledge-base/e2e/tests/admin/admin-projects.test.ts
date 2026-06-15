import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("projects admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that global prerequisites exist. */
		await db.getTestAsset();
		await db.getProjectScope();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerProjects(testInfo.workerIndex);
		await db.cleanupWorkerSocialMedia(testInfo.workerIndex);
	});

	test("should create a project", async ({ createAdminProjectsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);

		const projectName = `${adminProjectsPage.workerPrefix} Test Project ${randomUUID()}`;
		const acronym = "E2EP";
		const funding = 12345;
		const topic = "E2E project topic";
		const call = "E2E project call";
		const summary = "E2E test project summary";
		const description = "E2E test project description.";
		await adminProjectsPage.gotoCreate();

		await adminProjectsPage.fillName(projectName);
		await adminProjectsPage.fillAcronym(acronym);
		await adminProjectsPage.fillFunding(funding);
		await adminProjectsPage.fillTopic(topic);
		await adminProjectsPage.fillCall(call);
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillDatePicker("End date", 2024, 12, 31);
		await adminProjectsPage.fillSummary(summary);

		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");

		await adminProjectsPage.fillDescription(description);

		await adminProjectsPage.submitForm();

		await adminProjectsPage.searchByName(projectName);
		await expect(adminProjectsPage.projectRowByName(projectName)).toBeVisible();

		const created = await db.getProjectByName(projectName);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({
			acronym,
			call,
			funding,
			name: projectName,
			summary,
			topic,
		});
		expect(created?.imageId).toBeTruthy();
		expect(created?.duration?.start).toStrictEqual(new Date("2024-01-15T00:00:00.000Z"));
		expect(created?.duration?.end).toStrictEqual(new Date("2024-12-31T00:00:00.000Z"));
		expect(JSON.stringify(await db.getProjectDescriptionByName(projectName))).toContain(
			description,
		);
	});

	test("should store images inserted in project rich-text descriptions as image content blocks", async ({
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);
		const testAsset = await db.getTestAsset();

		const projectName = `${adminProjectsPage.workerPrefix} Rich Text Image ${randomUUID()}`;
		const descriptionBeforeImage = "E2E project description before image.";
		const descriptionAfterImage = "E2E project description after image.";

		await adminProjectsPage.gotoCreate();
		await adminProjectsPage.fillName(projectName);
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillSummary("E2E test project with rich-text image");
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await adminProjectsPage.fillDescription(descriptionBeforeImage);
		await adminProjectsPage.insertImageInDescription("E2E Test Asset");
		await adminProjectsPage.typeDescriptionAfterImage(descriptionAfterImage);

		await adminProjectsPage.submitForm();

		const blocks = await db.getProjectDescriptionContentBlocksByName(projectName);
		expect(blocks.map((block) => block.type)).toStrictEqual(["rich_text", "image", "rich_text"]);
		expect(JSON.stringify(blocks[0]?.content)).toContain(descriptionBeforeImage);
		expect(blocks[1]?.imageId).toBe(testAsset.id);
		expect(JSON.stringify(blocks[2]?.content)).toContain(descriptionAfterImage);
	});

	test("should edit all project form fields", async ({ page, createAdminProjectsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);

		const originalName = `${adminProjectsPage.workerPrefix} Edit Me ${randomUUID()}`;
		await adminProjectsPage.gotoCreate();
		await adminProjectsPage.fillName(originalName);
		await adminProjectsPage.fillAcronym("E2EOLD");
		await adminProjectsPage.fillFunding(1000);
		await adminProjectsPage.fillTopic("Old E2E project topic");
		await adminProjectsPage.fillCall("Old E2E project call");
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillDatePicker("End date", 2024, 12, 31);
		await adminProjectsPage.fillSummary("E2E test project to be edited");
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await adminProjectsPage.fillDescription("Description for edit test.");
		await adminProjectsPage.submitForm();

		// Find the project row and navigate to its edit page via the slug.
		// The slug is derived from the name; we navigate via the actions menu.
		await adminProjectsPage.searchByName(originalName);
		const row = adminProjectsPage.projectRowByName(originalName);
		await expect(row).toBeVisible();

		// Click the edit menu item for this row.
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${adminProjectsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedAcronym = "E2ENEW";
		const updatedFunding = 67890;
		const updatedTopic = "Updated E2E project topic";
		const updatedCall = "Updated E2E project call";
		const updatedSummary = "Updated E2E test project summary";
		const updatedDescription = "Updated E2E test project description.";
		await page.getByRole("main").getByLabel("Name").fill(updatedName);
		await adminProjectsPage.fillAcronym(updatedAcronym);
		await adminProjectsPage.fillFunding(updatedFunding);
		await adminProjectsPage.fillTopic(updatedTopic);
		await adminProjectsPage.fillCall(updatedCall);
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2025, 2, 16);
		await adminProjectsPage.fillDatePicker("End date", 2025, 11, 30);
		await adminProjectsPage.fillSummary(updatedSummary);
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		const descriptionEditor = page.getByRole("textbox", { name: "Description" });
		await descriptionEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedDescription);

		await adminProjectsPage.submitForm();

		// The updated name should appear in the list.
		await adminProjectsPage.searchByName(updatedName);
		await expect(adminProjectsPage.projectRowByName(updatedName)).toBeVisible();
		await adminProjectsPage.searchByName(originalName);
		await expect(adminProjectsPage.projectRowByName(originalName)).toBeHidden();

		const updated = await db.getProjectByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			acronym: updatedAcronym,
			call: updatedCall,
			funding: updatedFunding,
			name: updatedName,
			summary: updatedSummary,
			topic: updatedTopic,
		});
		expect(updated?.imageId).toBeTruthy();
		expect(updated?.duration?.start).toStrictEqual(new Date("2025-02-16T00:00:00.000Z"));
		expect(updated?.duration?.end).toStrictEqual(new Date("2025-11-30T00:00:00.000Z"));
		expect(JSON.stringify(await db.getProjectDescriptionByName(updatedName))).toContain(
			updatedDescription,
		);
	});

	test("should persist project social media fields", async ({
		page,
		createAdminProjectsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);
		const originalName = `${adminProjectsPage.workerPrefix} Relations ${randomUUID()}`;
		const socialMediaName = `${adminProjectsPage.workerPrefix} Relation Project Social ${randomUUID()}`;
		const socialMediaUrl = "https://example.com/project-social-relations";

		await adminProjectsPage.gotoCreate();
		await adminProjectsPage.fillName(originalName);
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillSummary("Project relation test");
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await adminProjectsPage.fillDescription("Description for relation test.");
		await adminProjectsPage.submitForm();

		await adminProjectsPage.searchByName(originalName);
		const row = adminProjectsPage.projectRowByName(originalName);
		await expect(row).toBeVisible();
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${adminProjectsPage.workerPrefix} Relations Updated ${randomUUID()}`;
		await page.getByRole("main").getByLabel("Name").fill(updatedName);
		await adminProjectsPage.createSocialMediaInForm(socialMediaName, socialMediaUrl);
		await adminProjectsPage.submitForm();

		const socialMedia = await db.getSocialMediaByName(socialMediaName);
		expect(socialMedia).toMatchObject({ name: socialMediaName, url: socialMediaUrl });
		const relations = await db.getProjectRelationsByName(updatedName);
		expect(relations?.socialMediaIds).toContain(socialMedia!.id);
	});

	test("should clear optional project fields", async ({ page, createAdminProjectsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);
		const originalName = `${adminProjectsPage.workerPrefix} Clear Optional ${randomUUID()}`;
		const socialMediaName = `${adminProjectsPage.workerPrefix} Clear Project Social ${randomUUID()}`;

		await adminProjectsPage.gotoCreate();
		await adminProjectsPage.fillName(originalName);
		await adminProjectsPage.fillAcronym("OPT");
		await adminProjectsPage.fillFunding(100);
		await adminProjectsPage.fillTopic("Optional topic");
		await adminProjectsPage.fillCall("Optional call");
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillDatePicker("End date", 2024, 12, 31);
		await adminProjectsPage.fillSummary("Project with optional fields to clear");
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await adminProjectsPage.fillDescription("Optional description to clear.");
		await adminProjectsPage.createSocialMediaInForm(
			socialMediaName,
			"https://example.com/project-clear",
		);
		await adminProjectsPage.submitForm();

		await adminProjectsPage.searchByName(originalName);
		const row = adminProjectsPage.projectRowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${adminProjectsPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByRole("main").getByLabel("Name").fill(updatedName);
		await adminProjectsPage.fillAcronym("");
		await adminProjectsPage.fillFunding(0);
		await page.getByLabel("Funding").clear();
		await adminProjectsPage.fillTopic("");
		await adminProjectsPage.fillCall("");
		await adminProjectsPage.clearDatePicker("End date");
		await adminProjectsPage.removeImage();
		await adminProjectsPage.removeAllTagsInControl("Social media");
		await adminProjectsPage.submitForm();

		const updated = await db.getProjectByName(updatedName);
		expect(updated).toMatchObject({
			acronym: null,
			call: null,
			funding: null,
			imageId: null,
			topic: null,
		});
		expect(updated?.duration?.end).toBeUndefined();
		const relations = await db.getProjectRelationsByName(updatedName);
		expect(relations).toMatchObject({ socialMediaIds: [] });
	});

	test("should delete a project", async ({ createAdminProjectsPage }) => {
		const workerIndex = test.info().workerIndex;
		const adminProjectsPage = createAdminProjectsPage(workerIndex);

		// Create a project via the UI.
		const projectName = `${adminProjectsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await adminProjectsPage.gotoCreate();
		await adminProjectsPage.fillName(projectName);
		await adminProjectsPage.selectFirstScope();
		await adminProjectsPage.fillDatePicker("Start date", 2024, 1, 15);
		await adminProjectsPage.fillSummary("E2E test project to be deleted");
		await adminProjectsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await adminProjectsPage.fillDescription("Description for delete test.");
		await adminProjectsPage.submitForm();

		await adminProjectsPage.searchByName(projectName);
		await expect(adminProjectsPage.projectRowByName(projectName)).toBeVisible();

		// Open the delete dialog and confirm.
		const deleteDialog = await adminProjectsPage.openDeleteDialog(projectName);
		await expect(deleteDialog).toBeVisible();
		await adminProjectsPage.confirmDelete(deleteDialog);

		// The project row should no longer be visible.
		await expect(adminProjectsPage.projectRowByName(projectName)).toBeHidden();
	});
});
