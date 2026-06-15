import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("admin documentation pages lifecycle", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerDocumentationPagesLifecycleItems(testInfo.workerIndex);
	});

	test("draft → publish → edit → discard draft", async ({
		page,
		createAdminDocumentationPagesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPagesPage = createAdminDocumentationPagesPage(workerIndex);

		const title = `${docPagesPage.workerPrefix} Lifecycle ${randomUUID()}`;
		const content = `Lifecycle documentation content ${randomUUID()}`;

		// Create — item starts in draft state.
		await docPagesPage.gotoCreate();
		await docPagesPage.fillTitle(title);
		await docPagesPage.addContentBlock(content);
		await docPagesPage.submitForm();

		let contentBlocks = await db.getDocumentationPageContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(contentBlocks[0]!.type).toBe("rich_text");
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		// List: draft badge visible.
		await docPagesPage.searchByTitle(title);
		await expect(docPagesPage.draftBadgeInRow(title)).toBeVisible();
		await expect(docPagesPage.publishedBadgeInRow(title)).toBeHidden();

		// Details: "Draft" badge, Publish button, no Discard button.
		await docPagesPage.gotoDetailsFromList(title);
		await expect(docPagesPage.detailsDraftBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();

		// Publish → redirected to list.
		await docPagesPage.publishItem();

		// List: row reads as published-only right after publish.
		await docPagesPage.searchByTitle(title);
		await expect(docPagesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(docPagesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: clean published-only state.
		await docPagesPage.gotoDetailsFromList(title);
		await expect(docPagesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(docPagesPage.versionSelectorDraftLink()).toBeHidden();

		// Edit the draft — changes the draft's updated_at so it diverges from published.
		await docPagesPage.gotoEditFromDetails();
		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(`${title} Edited`);
		const updatedContent = `Updated lifecycle documentation content ${randomUUID()}`;
		await docPagesPage.updateContentBlockText(updatedContent);
		await docPagesPage.submitForm();

		contentBlocks = await db.getDocumentationPageContentBlocksByTitle(`${title} Edited`);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
		expect(JSON.stringify(contentBlocks[0]!.content)).not.toContain(content);

		// List: both badges now visible.
		await docPagesPage.searchByTitle(`${title} Edited`);
		await expect(docPagesPage.publishedBadgeInRow(`${title} Edited`)).toBeVisible();
		await expect(docPagesPage.draftBadgeInRow(`${title} Edited`)).toBeVisible();

		// Details: "Published with draft changes" + Discard.
		await docPagesPage.gotoDetailsFromList(`${title} Edited`);
		await expect(docPagesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeVisible();

		// Discard draft → redirected to list.
		await docPagesPage.discardDraft();

		// List: only published remains (original title restored).
		await docPagesPage.searchByTitle(title);
		await expect(docPagesPage.publishedBadgeInRow(title)).toBeVisible();
		await expect(docPagesPage.draftBadgeInRow(title)).toBeHidden();

		// Details: "Published" only, no Discard, no version selector.
		await docPagesPage.gotoDetailsFromList(title);
		await expect(docPagesPage.detailsPublishedBadge()).toBeVisible();
		await expect(page.getByRole("button", { name: "Discard draft" })).toBeHidden();
		await expect(docPagesPage.versionSelectorDraftLink()).toBeHidden();
	});

	test("version selector shows correct content per version", async ({
		page,
		createAdminDocumentationPagesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const docPagesPage = createAdminDocumentationPagesPage(workerIndex);

		const originalTitle = `${docPagesPage.workerPrefix} Original ${randomUUID()}`;
		const updatedTitle = `${docPagesPage.workerPrefix} Updated ${randomUUID()}`;
		const originalContent = `Original documentation content ${randomUUID()}`;
		const updatedContent = `Updated documentation content ${randomUUID()}`;

		// Create → Publish.
		await docPagesPage.gotoCreate();
		await docPagesPage.fillTitle(originalTitle);
		await docPagesPage.addContentBlock(originalContent);
		await docPagesPage.submitForm();

		await docPagesPage.searchByTitle(originalTitle);
		await docPagesPage.gotoDetailsFromList(originalTitle);
		await docPagesPage.publishItem();

		// From the published-only details page, click Edit and update the title.
		await docPagesPage.searchByTitle(originalTitle);
		await docPagesPage.gotoDetailsFromList(originalTitle);
		await expect(docPagesPage.detailsPublishedBadge()).toBeVisible();
		await docPagesPage.gotoEditFromDetails();

		const titleField = page.getByLabel("Title");
		await titleField.clear();
		await titleField.fill(updatedTitle);
		await docPagesPage.updateContentBlockText(updatedContent);
		await docPagesPage.submitForm();

		const contentBlocks = await db.getDocumentationPageContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
		expect(JSON.stringify(contentBlocks[0]!.content)).not.toContain(originalContent);

		// Details: "Published with draft changes" with version selector.
		await docPagesPage.searchByTitle(updatedTitle);
		await docPagesPage.gotoDetailsFromList(updatedTitle);
		await expect(docPagesPage.detailsPublishedWithDraftChangesBadge()).toBeVisible();
		await expect(docPagesPage.versionSelectorDraftLink()).toBeVisible();
		await expect(docPagesPage.versionSelectorPublishedLink()).toBeVisible();

		// Currently on draft tab — updated title shown.
		await expect(page.getByText(updatedTitle)).toBeVisible();
		await expect(page.getByText(updatedContent)).toBeVisible();

		// Switch to published tab — original title shown.
		await docPagesPage.versionSelectorPublishedLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") === "published");
		await expect(page.getByText(originalTitle)).toBeVisible();
		await expect(page.getByText(originalContent)).toBeVisible();
		await expect(page.getByText(updatedTitle)).toBeHidden();
		await expect(page.getByText(updatedContent)).toBeHidden();

		// Switch back to draft tab — updated title shown again.
		await docPagesPage.versionSelectorDraftLink().click();
		await page.waitForURL((url) => url.searchParams.get("version") == null);
		await expect(page.getByText(updatedTitle)).toBeVisible();
	});
});
