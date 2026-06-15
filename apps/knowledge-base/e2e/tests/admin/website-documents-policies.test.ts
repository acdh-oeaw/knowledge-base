import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website documents-policies admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that global prerequisites exist. */
		await db.getTestDocumentAsset();
		await db.getDocumentPolicyGroup();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerDocumentsPoliciesLifecycleItems(testInfo.workerIndex);
		await db.cleanupWorkerDocumentPolicyGroups(testInfo.workerIndex);
	});

	test("should create, rename, reorder, and delete groups", async ({
		createWebsiteDocumentsPoliciesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);
		const suffix = randomUUID();
		const firstLabel = `${docPoliciesPage.workerPrefix} Group A ${suffix}`;
		const secondLabel = `${docPoliciesPage.workerPrefix} Group B ${suffix}`;
		const renamedLabel = `${docPoliciesPage.workerPrefix} Group A renamed ${suffix}`;

		await docPoliciesPage.goto();
		await docPoliciesPage.createGroup(firstLabel);
		await docPoliciesPage.createGroup(secondLabel);

		await expect(docPoliciesPage.groupSection(firstLabel)).toBeVisible();
		await expect(docPoliciesPage.groupSection(secondLabel)).toBeVisible();
		await expect
			.poll(async () => {
				const groups = await db.getDocumentPolicyGroupsByLabelPrefix(docPoliciesPage.workerPrefix);
				return groups.map((group) => group.label);
			})
			.toStrictEqual([firstLabel, secondLabel]);

		await docPoliciesPage.editGroup(firstLabel, renamedLabel);
		await expect(docPoliciesPage.groupSection(firstLabel)).toBeHidden();
		await expect(docPoliciesPage.groupSection(renamedLabel)).toBeVisible();

		await docPoliciesPage.moveGroup(secondLabel, "up");
		await expect
			.poll(async () => {
				const groups = await db.getDocumentPolicyGroupsByLabelPrefix(docPoliciesPage.workerPrefix);
				return groups.map((group) => group.label);
			})
			.toStrictEqual([secondLabel, renamedLabel]);
		await docPoliciesPage.goto();
		await expect
			.poll(async () => docPoliciesPage.groupLabels(), { timeout: 15_000 })
			.toContainEqual(secondLabel);
		const orderedLabels = await docPoliciesPage.groupLabels();
		expect(orderedLabels.indexOf(secondLabel)).toBeLessThan(orderedLabels.indexOf(renamedLabel));
		await expect(docPoliciesPage.groupSection(secondLabel)).toBeVisible();
		await expect(docPoliciesPage.groupSection(renamedLabel)).toBeVisible();

		await docPoliciesPage.deleteGroup(secondLabel);
		await expect(docPoliciesPage.groupSection(secondLabel)).toBeHidden();
		await docPoliciesPage.deleteGroup(renamedLabel);
		await expect(docPoliciesPage.groupSection(renamedLabel)).toBeHidden();
		await expect
			.poll(async () => db.getDocumentPolicyGroupsByLabelPrefix(docPoliciesPage.workerPrefix))
			.toStrictEqual([]);
	});

	test("should create a document or policy", async ({ createWebsiteDocumentsPoliciesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);

		const title = `${docPoliciesPage.workerPrefix} Test Document ${randomUUID()}`;
		const summary = "E2E test document or policy summary";
		const url = "https://example.com/document-policy";
		const content = `E2E document or policy content ${randomUUID()}`;
		const testDocument = await db.getTestDocumentAsset();
		const group = await db.getDocumentPolicyGroup();

		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(title);
		await docPoliciesPage.fillSummary(summary);
		await docPoliciesPage.fillUrl(url);
		await docPoliciesPage.selectFirstGroup();
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.addContentBlock(content);
		await docPoliciesPage.submitForm();

		await docPoliciesPage.searchByTitle(title);
		await expect(docPoliciesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getDocumentOrPolicyByTitle(title);
		expect(created).toMatchObject({ documentId: testDocument.id, groupId: group.id, summary, url });
		const contentBlocks = await db.getDocumentOrPolicyContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit a document or policy via inline dialog", async ({
		createWebsiteDocumentsPoliciesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);
		const testDocument = await db.getTestDocumentAsset();

		const originalTitle = `${docPoliciesPage.workerPrefix} Edit Dialog ${randomUUID()}`;
		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(originalTitle);
		await docPoliciesPage.fillSummary("Document or policy to be edited via dialog");
		await docPoliciesPage.fillUrl("https://example.com/original");
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.submitForm();

		const updatedTitle = `${docPoliciesPage.workerPrefix} Updated Dialog ${randomUUID()}`;
		const updatedSummary = "Updated via inline edit dialog";
		const updatedUrl = "https://example.com/updated";

		await docPoliciesPage.openEditDialog(originalTitle);
		await docPoliciesPage.fillTitle(updatedTitle);
		await docPoliciesPage.fillSummary(updatedSummary);
		await docPoliciesPage.fillUrl(updatedUrl);
		await docPoliciesPage.submitEditDialog();

		await docPoliciesPage.searchByTitle(updatedTitle);
		await expect(docPoliciesPage.rowByTitle(updatedTitle)).toBeVisible();

		const updated = await db.getDocumentOrPolicyByTitle(updatedTitle);
		expect(updated).toMatchObject({
			documentId: testDocument.id,
			summary: updatedSummary,
			url: updatedUrl,
		});
	});

	test("should clear optional summary and url via inline dialog", async ({
		createWebsiteDocumentsPoliciesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);
		const title = `${docPoliciesPage.workerPrefix} Clear URL ${randomUUID()}`;

		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(title);
		await docPoliciesPage.fillSummary("Document or policy with URL to clear");
		await docPoliciesPage.fillUrl("https://example.com/to-be-cleared");
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.submitForm();

		await docPoliciesPage.openEditDialog(title);
		await docPoliciesPage.fillSummary("");
		await docPoliciesPage.fillUrl("");
		await docPoliciesPage.submitEditDialog();

		const updated = await db.getDocumentOrPolicyByTitle(title);
		expect(updated).toMatchObject({ summary: null, url: null });
	});

	test("should delete a document or policy", async ({ createWebsiteDocumentsPoliciesPage }) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);

		const title = `${docPoliciesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(title);
		await docPoliciesPage.fillSummary("E2E test document or policy to be deleted");
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.submitForm();

		await docPoliciesPage.searchByTitle(title);
		await expect(docPoliciesPage.rowByTitle(title)).toBeVisible();

		const deleteDialog = await docPoliciesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await docPoliciesPage.confirmDelete(deleteDialog);

		await expect(docPoliciesPage.rowByTitle(title)).toBeHidden();
	});
});
