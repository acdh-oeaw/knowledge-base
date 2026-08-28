import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("website documents-policies lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		await db.getTestDocumentAsset();
		await db.getDocumentPolicyGroup();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerDocumentsPoliciesLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		db,
		page,
		createWebsiteDocumentsPoliciesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);

		const title = `${docPoliciesPage.workerPrefix} Lifecycle ${randomUUID()}`;
		const summary = "Lifecycle test document or policy summary";
		const url = "https://example.com/document-policy";
		const content = `E2E document or policy content ${randomUUID()}`;
		const testDocument = await db.getTestDocumentAsset();
		const group = await db.getDocumentPolicyGroup();

		// Create — item starts in draft state.
		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(title);
		await docPoliciesPage.fillSummary(summary);
		await docPoliciesPage.fillUrl(url);
		await docPoliciesPage.selectGroup(group.label);
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.addContentBlock(content);
		await docPoliciesPage.submitForm();

		let documentOrPolicy = await db.getDocumentOrPolicyByTitle(title);
		expect(documentOrPolicy).toMatchObject({
			documentId: testDocument.id,
			groupId: group.id,
			summary,
			url,
		});
		let contentBlocks = await db.getDocumentOrPolicyContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		// List: draft badge visible.
		await docPoliciesPage.searchByTitle(title);
		await expect(docPoliciesPage.draftBadgeInRow(title)).toBeVisible();
		await expect(docPoliciesPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await docPoliciesPage.gotoDetailsFromList(title);
		await expect(docPoliciesPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await docPoliciesPage.publishItem();

		// List: row reads as published-only right after publish.
		await docPoliciesPage.searchByTitle(title);
		await expect(docPoliciesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(docPoliciesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await docPoliciesPage.gotoDetailsFromList(title);
		await expect(docPoliciesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(docPoliciesPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — title change diverges draft from published.
		await docPoliciesPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		const updatedSummary = "Updated lifecycle document or policy summary";
		const updatedUrl = "https://example.com/updated-document-policy";
		const updatedContent = `Updated document or policy content ${randomUUID()}`;
		await docPoliciesPage.fillSummary(updatedSummary);
		await docPoliciesPage.fillUrl(updatedUrl);
		await docPoliciesPage.selectGroup(group.label);
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.updateContentBlockText(updatedContent);
		await docPoliciesPage.submitForm();

		documentOrPolicy = await db.getDocumentOrPolicyByTitle(`${title} Edited`);
		expect(documentOrPolicy).toMatchObject({
			documentId: testDocument.id,
			groupId: group.id,
			summary: updatedSummary,
			url: updatedUrl,
		});
		contentBlocks = await db.getDocumentOrPolicyContentBlocksByTitle(`${title} Edited`);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);

		// List: both badges now visible.
		await docPoliciesPage.searchByTitle(`${title} Edited`);
		await expect(docPoliciesPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(docPoliciesPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await docPoliciesPage.gotoDetailsFromList(`${title} Edited`);
		await expect(docPoliciesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await docPoliciesPage.discardDraft();

		// List: only published remains (original title restored).
		await docPoliciesPage.searchByTitle(title);
		await expect(docPoliciesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(docPoliciesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await docPoliciesPage.gotoDetailsFromList(title);
		await expect(docPoliciesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(docPoliciesPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createWebsiteDocumentsPoliciesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);

		const originalTitle = `${docPoliciesPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${docPoliciesPage.workerPrefix} Updated ${randomUUID()}`;

		// Create → Publish.
		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(originalTitle);
		await docPoliciesPage.fillSummary("Version selector test document or policy");
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.submitForm();

		await docPoliciesPage.searchByTitle(originalTitle);
		await docPoliciesPage.gotoDetailsFromList(originalTitle);
		await docPoliciesPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await docPoliciesPage.searchByTitle(originalTitle);
		await docPoliciesPage.gotoDetailsFromList(originalTitle);
		await expect(docPoliciesPage.detailsPublishedBadge()).toBeVisible();
		await docPoliciesPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await docPoliciesPage.submitForm();

		// Details: "Published with draft changes" with version selector.
		await docPoliciesPage.searchByTitle(updatedTitle);
		await docPoliciesPage.gotoDetailsFromList(updatedTitle);
		await expect(docPoliciesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(docPoliciesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(docPoliciesPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();

		// Switch to published tab — original title shown.
		await docPoliciesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await docPoliciesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});

	test("should clear optional document or policy fields", async ({
		createWebsiteDocumentsPoliciesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPoliciesPage = createWebsiteDocumentsPoliciesPage(workerIndex);
		const title = `${docPoliciesPage.workerPrefix} Clear Optional ${randomUUID()}`;
		const group = await db.getDocumentPolicyGroup();

		await docPoliciesPage.gotoCreate();
		await docPoliciesPage.fillTitle(title);
		await docPoliciesPage.fillSummary("Document or policy with optional fields to clear");
		await docPoliciesPage.fillUrl("https://example.com/document-policy-clear");
		await docPoliciesPage.selectGroup(group.label);
		await docPoliciesPage.selectDocumentFromMediaLibrary("E2E Test Document");
		await docPoliciesPage.addContentBlock("Optional document or policy content");
		await docPoliciesPage.submitForm();

		await docPoliciesPage.searchByTitle(title);
		await docPoliciesPage.gotoEditFromList(title);

		await docPoliciesPage.fillUrl("");
		await docPoliciesPage.selectNoGroup();
		await docPoliciesPage.removeFirstContentBlock();
		await docPoliciesPage.submitForm();

		const updated = await db.getDocumentOrPolicyByTitle(title);
		expect(updated).toMatchObject({ groupId: null, url: null });
		expect(await db.getDocumentOrPolicyContentBlocksByTitle(title)).toHaveLength(0);
	});
});
