import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("working groups admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerWorkingGroups(testInfo.workerIndex);
	});

	test("should create a working group", async ({ createAdminWorkingGroupsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);

		const name = `${workingGroupsPage.workerPrefix} Test WG ${randomUUID()}`;
		const acronym = "E2EWG";
		const sshocMarketplaceActorId = 123456;
		const summary = "E2E test working group summary.";
		const description = "E2E test working group description.";
		const testAsset = await db.getTestAsset();

		await workingGroupsPage.gotoCreate();

		await workingGroupsPage.fillName(name);
		await workingGroupsPage.fillAcronym(acronym);
		await workingGroupsPage.fillSshocMarketplaceActorId(sshocMarketplaceActorId);
		await workingGroupsPage.selectTestImage();
		await workingGroupsPage.fillSummary(summary);
		await workingGroupsPage.fillDescription(description);

		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(name);
		await expect(workingGroupsPage.rowByName(name)).toBeVisible();

		const created = await db.getWorkingGroupByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({
			acronym,
			imageId: testAsset.id,
			name,
			sshocMarketplaceActorId,
			summary,
		});
		expect(JSON.stringify(await db.getWorkingGroupDescriptionByName(name))).toContain(description);
	});

	test("should edit all working group form fields", async ({
		page,
		createAdminWorkingGroupsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);

		const originalName = `${workingGroupsPage.workerPrefix} Edit Me ${randomUUID()}`;
		const testAsset = await db.getTestAsset();

		await workingGroupsPage.gotoCreate();
		await workingGroupsPage.fillName(originalName);
		await workingGroupsPage.fillAcronym("E2EOLD");
		await workingGroupsPage.fillSshocMarketplaceActorId(123457);
		await workingGroupsPage.selectTestImage();
		await workingGroupsPage.fillSummary("E2E test working group to be edited.");
		await workingGroupsPage.fillDescription("Description for edit test.");
		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(originalName);
		const row = workingGroupsPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${workingGroupsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedAcronym = "E2ENEW";
		const updatedSshocMarketplaceActorId = 123458;
		const updatedSummary = "Updated E2E test working group summary.";
		const updatedDescription = "Updated E2E test working group description.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await workingGroupsPage.fillAcronym(updatedAcronym);
		await workingGroupsPage.fillSshocMarketplaceActorId(updatedSshocMarketplaceActorId);
		await workingGroupsPage.selectTestImage();
		await workingGroupsPage.fillSummary(updatedSummary);
		const descriptionEditor = page.getByRole("textbox", { name: "Description" });
		await descriptionEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedDescription);

		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(updatedName);
		await expect(workingGroupsPage.rowByName(updatedName)).toBeVisible();
		await workingGroupsPage.searchByName(originalName);
		await expect(workingGroupsPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getWorkingGroupByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			acronym: updatedAcronym,
			imageId: testAsset.id,
			name: updatedName,
			sshocMarketplaceActorId: updatedSshocMarketplaceActorId,
			summary: updatedSummary,
		});
		expect(JSON.stringify(await db.getWorkingGroupDescriptionByName(updatedName))).toContain(
			updatedDescription,
		);
	});

	test("should clear optional working group fields", async ({
		page,
		createAdminWorkingGroupsPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);
		const originalName = `${workingGroupsPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await workingGroupsPage.gotoCreate();
		await workingGroupsPage.fillName(originalName);
		await workingGroupsPage.fillAcronym("OPTWG");
		await workingGroupsPage.fillSshocMarketplaceActorId(123459);
		await workingGroupsPage.selectTestImage();
		await workingGroupsPage.fillSummary("Optional working group summary");
		await workingGroupsPage.fillDescription("Required description for clear test.");
		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(originalName);
		const row = workingGroupsPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${workingGroupsPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await workingGroupsPage.fillAcronym("");
		await page.locator('input[name="sshocMarketplaceActorId"]').fill("");
		await workingGroupsPage.fillSummary("");
		await workingGroupsPage.removeImage();
		await workingGroupsPage.submitForm();

		const updated = await db.getWorkingGroupByName(updatedName);
		expect(updated).toMatchObject({
			acronym: null,
			imageId: null,
			sshocMarketplaceActorId: null,
			summary: null,
		});
	});

	test("should manage unit relations", async ({ createAdminWorkingGroupsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);

		const name = `${workingGroupsPage.workerPrefix} Relations ${randomUUID()}`;
		await workingGroupsPage.gotoCreate();
		await workingGroupsPage.fillName(name);
		await workingGroupsPage.fillSummary("Working group for relation test.");
		await workingGroupsPage.fillDescription("Description for relation test.");
		await workingGroupsPage.submitForm();

		await workingGroupsPage.gotoEditFromList(name);
		await workingGroupsPage.goToRelationsTab();

		// Add a relation.
		await workingGroupsPage.selectFirstRelationType();
		await workingGroupsPage.selectFirstRelatedUnit();
		await workingGroupsPage.fillRelationDatePicker("Start date", 2025, 1, 1);
		await workingGroupsPage.submitAddRelation();

		// Verify relation row appears (header row + 1 data row = 2).
		await expect(workingGroupsPage.relationsTable().getByRole("row")).toHaveCount(2);

		const workingGroup = await db.getWorkingGroupByName(name);
		const relations = await db.getUnitRelationsByUnitVersionId(workingGroup!.id);
		expect(relations).toHaveLength(1);
		expect(relations[0]!.duration.start).toStrictEqual(new Date("2025-01-01T00:00:00.000Z"));
		expect(relations[0]!.duration.end).toBeUndefined();

		// End the relation.
		await workingGroupsPage.clickEndRelation();
		await workingGroupsPage.fillEndRelationDate(2025, 12, 31);
		await workingGroupsPage.confirmEndRelation();

		// Verify "End relation" action is gone and "present" is replaced by a date.
		await workingGroupsPage
			.relationsTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await expect(
			workingGroupsPage.page.getByRole("menuitem", { name: "End relation" }),
		).toBeHidden();
		await workingGroupsPage.page.keyboard.press("Escape");
		await expect(workingGroupsPage.relationsTable().getByText("present")).toBeHidden();

		// Verify end date persisted.
		const updatedRelations = await db.getUnitRelationsByUnitVersionId(workingGroup!.id);
		expect(updatedRelations[0]!.duration.end).toBeDefined();
	});

	test("should delete a working group", async ({ createAdminWorkingGroupsPage }) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);

		const name = `${workingGroupsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await workingGroupsPage.gotoCreate();
		await workingGroupsPage.fillName(name);
		await workingGroupsPage.fillSummary("E2E test working group to be deleted.");
		await workingGroupsPage.fillDescription("Description for delete test.");
		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(name);
		await expect(workingGroupsPage.rowByName(name)).toBeVisible();

		const deleteDialog = await workingGroupsPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await workingGroupsPage.confirmDelete(deleteDialog);

		await expect(workingGroupsPage.rowByName(name)).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminWorkingGroupsPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const workingGroupsPage = createAdminWorkingGroupsPage(workerIndex);

		const name = `${workingGroupsPage.workerPrefix} VersionSelector ${randomUUID()}`;
		const originalSummary = `${workingGroupsPage.workerPrefix} Original summary ${randomUUID()}`;
		const updatedSummary = `${workingGroupsPage.workerPrefix} Updated summary ${randomUUID()}`;

		// Create → Publish. Right after publishing the details page reads as published-only
		// (the cloned draft row exists but has no changes from the published version).
		await workingGroupsPage.gotoCreate();
		await workingGroupsPage.fillName(name);
		await workingGroupsPage.fillSummary(originalSummary);
		await workingGroupsPage.selectTestImage();
		await workingGroupsPage.fillDescription("Version selector test description.");
		await workingGroupsPage.submitForm();

		await workingGroupsPage.searchByName(name);
		await workingGroupsPage.gotoDetailsFromList(name);
		await workingGroupsPage.publishFromDetails();

		// Edit the draft's summary so it diverges from the published version.
		await workingGroupsPage.searchByName(name);
		await workingGroupsPage.gotoDetailsFromList(name);
		await expect(workingGroupsPage.detailsPublishedBadge()).toBeVisible();
		await workingGroupsPage.gotoEditFromDetails();
		await workingGroupsPage.fillSummary(updatedSummary);
		await workingGroupsPage.submitForm();

		// Details: "Published with draft changes" with both version links.
		await workingGroupsPage.searchByName(name);
		await workingGroupsPage.gotoDetailsFromList(name);
		await expect(workingGroupsPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(workingGroupsPage.versionSelectorDraftLink()).toBeVisible();
		await expect(workingGroupsPage.versionSelectorPublishedLink()).toBeVisible();

		// Draft tab (default) — updated summary shown.
		await expect(page.getByText(updatedSummary)).toBeVisible();

		// Switch to the published tab — original summary shown, updated hidden. This is the assertion
		// that guards against the details page rendering draft scalars under the published version.
		await workingGroupsPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalSummary)).toBeVisible();
		await expect(page.getByText(updatedSummary)).toBeHidden();

		// Switch back to the draft tab — updated summary shown again.
		await workingGroupsPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedSummary)).toBeVisible();
	});
});
