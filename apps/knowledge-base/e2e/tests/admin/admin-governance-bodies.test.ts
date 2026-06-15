import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("governance bodies admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerGovernanceBodies(testInfo.workerIndex);
	});

	test("should create a governance body", async ({ createAdminGovernanceBodiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} Test GB ${randomUUID()}`;
		const acronym = "E2EGB";
		const summary = "E2E test governance body summary.";
		const description = "E2E test governance body description.";
		const testAsset = await db.getTestAsset();

		await governanceBodiesPage.gotoCreate();

		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillAcronym(acronym);
		await governanceBodiesPage.fillSummary(summary);
		await governanceBodiesPage.selectTestImage();
		await governanceBodiesPage.fillDescription(description);

		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.searchByName(name);
		await expect(governanceBodiesPage.rowByName(name)).toBeVisible();

		const created = await db.getGovernanceBodyByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ acronym, imageId: testAsset.id, name, summary });
		expect(JSON.stringify(await db.getGovernanceBodyDescriptionByName(name))).toContain(
			description,
		);
	});

	test("should edit all governance body form fields", async ({
		page,
		createAdminGovernanceBodiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);
		const testAsset = await db.getTestAsset();

		const originalName = `${governanceBodiesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(originalName);
		await governanceBodiesPage.fillAcronym("E2EGBOLD");
		await governanceBodiesPage.fillSummary("E2E test governance body to be edited.");
		await governanceBodiesPage.fillDescription("Description for edit test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.searchByName(originalName);
		const row = governanceBodiesPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${governanceBodiesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedAcronym = "E2EGBNEW";
		const updatedSummary = "Updated E2E test governance body summary.";
		const updatedDescription = "Updated E2E test governance body description.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await governanceBodiesPage.fillAcronym(updatedAcronym);
		await governanceBodiesPage.fillSummary(updatedSummary);
		await governanceBodiesPage.selectTestImage();
		const descriptionEditor = page.getByRole("textbox", { name: "Description" });
		await descriptionEditor.click();
		await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
		await page.keyboard.type(updatedDescription);

		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.searchByName(updatedName);
		await expect(governanceBodiesPage.rowByName(updatedName)).toBeVisible();
		await governanceBodiesPage.searchByName(originalName);
		await expect(governanceBodiesPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getGovernanceBodyByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			acronym: updatedAcronym,
			imageId: testAsset.id,
			name: updatedName,
			summary: updatedSummary,
		});
		expect(JSON.stringify(await db.getGovernanceBodyDescriptionByName(updatedName))).toContain(
			updatedDescription,
		);
	});

	test("should clear optional governance body fields", async ({
		page,
		createAdminGovernanceBodiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);
		const originalName = `${governanceBodiesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(originalName);
		await governanceBodiesPage.fillAcronym("E2EGBOPT");
		await governanceBodiesPage.fillSummary("Optional governance body summary.");
		await governanceBodiesPage.selectTestImage();
		await governanceBodiesPage.fillDescription("Required description for clear test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.searchByName(originalName);
		const row = governanceBodiesPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${governanceBodiesPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await governanceBodiesPage.fillAcronym("");
		await governanceBodiesPage.fillSummary("");
		await governanceBodiesPage.removeImage();
		await governanceBodiesPage.submitForm();

		const updated = await db.getGovernanceBodyByName(updatedName);
		expect(updated).toMatchObject({ acronym: null, imageId: null, summary: null });
	});

	test("should manage person relations", async ({ createAdminGovernanceBodiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} Person Relations ${randomUUID()}`;
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for person relation test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.gotoEditFromList(name);
		await governanceBodiesPage.goToPeopleTab();

		// Add a person relation.
		await governanceBodiesPage.selectFirstPersonRole();
		await governanceBodiesPage.selectFirstPerson();
		await governanceBodiesPage.fillPersonRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddPerson();

		// Verify person row appears (header row + 1 data row = 2).
		await expect(governanceBodiesPage.peopleTable().getByRole("row")).toHaveCount(2);

		const governanceBody = await db.getGovernanceBodyByName(name);
		const relations = await db.getPersonRelationsByUnitVersionId(governanceBody!.id);
		expect(relations).toHaveLength(1);
		expect(relations[0]!.duration.start).toStrictEqual(new Date("2025-01-01T00:00:00.000Z"));
		expect(relations[0]!.duration.end).toBeUndefined();

		// End the person relation.
		await governanceBodiesPage.clickEndPersonRelation();
		await governanceBodiesPage.fillEndPersonRelationDate(2025, 12, 31);
		await governanceBodiesPage.confirmEndPersonRelation();

		// Verify "End person relation" action is gone and "present" is replaced by a date.
		await governanceBodiesPage
			.peopleTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await expect(
			governanceBodiesPage.page.getByRole("menuitem", { name: "End person relation" }),
		).toBeHidden();
		await governanceBodiesPage.page.keyboard.press("Escape");
		await expect(governanceBodiesPage.peopleTable().getByText("present")).toBeHidden();

		// Verify end date persisted.
		const updatedRelations = await db.getPersonRelationsByUnitVersionId(governanceBody!.id);
		expect(updatedRelations[0]!.duration.end).toBeDefined();
	});

	/**
	 * Unit↔unit and person↔org relations are document-level (keyed by entities.id): a single logical
	 * relation is one row that the lifecycle adapters never clone or wipe. Publishing — and
	 * re-publishing — the governance body must therefore leave each published version showing the
	 * relation exactly once: no loss, no version cross-product duplication.
	 */
	test("should keep document-level relations across publish and re-publish", async ({
		createAdminGovernanceBodiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} Publish Relations ${randomUUID()}`;
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for publish-relations test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.gotoEditFromList(name);

		// Add a unit relation.
		await governanceBodiesPage.goToRelationsTab();
		await governanceBodiesPage.selectFirstRelationType();
		await governanceBodiesPage.selectFirstRelatedUnit();
		await governanceBodiesPage.fillRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddRelation();

		// Add a person relation.
		await governanceBodiesPage.goToPeopleTab();
		await governanceBodiesPage.selectFirstPersonRole();
		await governanceBodiesPage.selectFirstPerson();
		await governanceBodiesPage.fillPersonRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddPerson();

		// Verify draft version has both relations.
		const draft = await db.getGovernanceBodyByName(name);
		expect(await db.getUnitRelationsByUnitVersionId(draft!.id)).toHaveLength(1);
		expect(await db.getPersonRelationsByUnitVersionId(draft!.id)).toHaveLength(1);

		// Publish from the edit form (governance bodies have no separate details page).
		await governanceBodiesPage.publishItem();

		// The relations are document-level, so the published version's read resolves them exactly once.
		const publishedId = await db.getPublishedVersionId(draft!.documentId);
		expect(publishedId).not.toBeNull();
		expect(await db.getUnitRelationsByUnitVersionId(publishedId!)).toHaveLength(1);
		expect(await db.getPersonRelationsByUnitVersionId(publishedId!)).toHaveLength(1);

		// Re-publish: edit a field to create a new draft, save it, then publish again. This wipes and
		// rebuilds the published subtype, but must leave the document-level relations untouched — still
		// exactly once on the new published version (no loss, no cross-product duplication).
		await governanceBodiesPage.gotoEditFromList(name);
		await governanceBodiesPage.fillDescription(" (re-published)");
		await governanceBodiesPage.submitForm();
		await governanceBodiesPage.gotoEditFromList(name);
		await governanceBodiesPage.publishItem();

		const republishedId = await db.getPublishedVersionId(draft!.documentId);
		expect(republishedId).not.toBeNull();
		expect(await db.getUnitRelationsByUnitVersionId(republishedId!)).toHaveLength(1);
		expect(await db.getPersonRelationsByUnitVersionId(republishedId!)).toHaveLength(1);
	});

	test("should manage unit relations", async ({ createAdminGovernanceBodiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} Unit Relations ${randomUUID()}`;
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for unit relation test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.gotoEditFromList(name);

		// Add a unit relation.
		await governanceBodiesPage.goToRelationsTab();
		await governanceBodiesPage.selectFirstRelationType();
		await governanceBodiesPage.selectFirstRelatedUnit();
		await governanceBodiesPage.fillRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddRelation();

		// Verify relation row appears (header row + 1 data row = 2).
		await expect(governanceBodiesPage.relationsTable().getByRole("row")).toHaveCount(2);

		const governanceBody = await db.getGovernanceBodyByName(name);
		const relations = await db.getUnitRelationsByUnitVersionId(governanceBody!.id);
		expect(relations).toHaveLength(1);
		expect(relations[0]!.duration.start).toStrictEqual(new Date("2025-01-01T00:00:00.000Z"));
		expect(relations[0]!.duration.end).toBeUndefined();

		// End the relation.
		await governanceBodiesPage.clickEndRelation();
		await governanceBodiesPage.fillEndRelationDate(2025, 12, 31);
		await governanceBodiesPage.confirmEndRelation();

		// Verify "End relation" action is gone and "present" is replaced by a date.
		await governanceBodiesPage
			.relationsTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await expect(
			governanceBodiesPage.page.getByRole("menuitem", { name: "End relation" }),
		).toBeHidden();
		await governanceBodiesPage.page.keyboard.press("Escape");
		await expect(governanceBodiesPage.relationsTable().getByText("present")).toBeHidden();

		// Verify end date persisted.
		const updatedRelations = await db.getUnitRelationsByUnitVersionId(governanceBody!.id);
		expect(updatedRelations[0]!.duration.end).toBeDefined();
	});

	/**
	 * Relations are document-level (keyed by entities.id) with no `ON DELETE CASCADE`, so the delete
	 * action must remove them on both endpoints before deleting the entity row — otherwise the
	 * `DELETE FROM entities` aborts with a FK violation. Delete a body that participates in both a
	 * unit↔unit and a person↔org relation to exercise that cleanup against the production action (not
	 * the test fixture's own teardown copy).
	 */
	test("should delete a governance body that participates in relations", async ({
		createAdminGovernanceBodiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for delete test.");
		await governanceBodiesPage.submitForm();

		// Give the body relations on both endpoints so the FK cleanup is actually exercised.
		await governanceBodiesPage.gotoEditFromList(name);
		await governanceBodiesPage.goToRelationsTab();
		await governanceBodiesPage.selectFirstRelationType();
		await governanceBodiesPage.selectFirstRelatedUnit();
		await governanceBodiesPage.fillRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddRelation();
		await governanceBodiesPage.goToPeopleTab();
		await governanceBodiesPage.selectFirstPersonRole();
		await governanceBodiesPage.selectFirstPerson();
		await governanceBodiesPage.fillPersonRelationDatePicker("Start date", 2025, 1, 1);
		await governanceBodiesPage.submitAddPerson();

		const created = await db.getGovernanceBodyByName(name);
		expect(await db.getUnitRelationsByUnitVersionId(created!.id)).toHaveLength(1);
		expect(await db.getPersonRelationsByUnitVersionId(created!.id)).toHaveLength(1);

		await governanceBodiesPage.goto();
		await governanceBodiesPage.searchByName(name);
		await expect(governanceBodiesPage.rowByName(name)).toBeVisible();

		const deleteDialog = await governanceBodiesPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await governanceBodiesPage.confirmDelete(deleteDialog);

		// With the relations present, a missing FK cleanup would make the delete action throw and leave
		// the row in place; succeeding here is the regression signal. (The relation rows are keyed by the
		// document id, which is gone once the entity is deleted, so they cannot be re-queried afterwards.)
		await expect(governanceBodiesPage.rowByName(name)).toBeHidden();
		expect(await db.getGovernanceBodyByName(name)).toBeNull();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminGovernanceBodiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);

		const name = `${governanceBodiesPage.workerPrefix} VersionSelector ${randomUUID()}`;
		const originalSummary = `${governanceBodiesPage.workerPrefix} Original summary ${randomUUID()}`;
		const updatedSummary = `${governanceBodiesPage.workerPrefix} Updated summary ${randomUUID()}`;

		// Create → Publish. Right after publishing the details page reads as published-only
		// (the cloned draft row exists but has no changes from the published version).
		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillSummary(originalSummary);
		await governanceBodiesPage.selectTestImage();
		await governanceBodiesPage.fillDescription("Version selector test description.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.searchByName(name);
		await governanceBodiesPage.gotoDetailsFromList(name);
		await governanceBodiesPage.publishFromDetails();

		// Edit the draft's summary so it diverges from the published version.
		await governanceBodiesPage.searchByName(name);
		await governanceBodiesPage.gotoDetailsFromList(name);
		await expect(governanceBodiesPage.detailsPublishedBadge()).toBeVisible();
		await governanceBodiesPage.gotoEditFromDetails();
		await governanceBodiesPage.fillSummary(updatedSummary);
		await governanceBodiesPage.submitForm();

		// Details: "Published with draft changes" with both version links.
		await governanceBodiesPage.searchByName(name);
		await governanceBodiesPage.gotoDetailsFromList(name);
		await expect(governanceBodiesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(governanceBodiesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(governanceBodiesPage.versionSelectorPublishedLink()).toBeVisible();

		// Draft tab (default) — updated summary shown.
		await expect(page.getByText(updatedSummary)).toBeVisible();

		// Switch to the published tab — original summary shown, updated hidden. This is the assertion
		// that guards against the details page rendering draft scalars under the published version.
		await governanceBodiesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalSummary)).toBeVisible();
		await expect(page.getByText(updatedSummary)).toBeHidden();

		// Switch back to the draft tab — updated summary shown again.
		await governanceBodiesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedSummary)).toBeVisible();
	});
});
