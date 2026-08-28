import { randomUUID } from "node:crypto";

import type { JSONContent } from "@tiptap/core";

import { expect, test } from "@/e2e/lib/test";

/** The first node of a kind anywhere in a stored document, for assertions that name one node. */
function findNode(doc: JSONContent, type: string): JSONContent | undefined {
	if (doc.type === type) {
		return doc;
	}

	for (const child of doc.content ?? []) {
		const found = findNode(child, type);
		if (found != null) {
			return found;
		}
	}

	return undefined;
}

/** The marks on the text run holding `text`, so an assertion names one run rather than the document. */
function marksOn(doc: JSONContent, text: string): Array<{ type: string; attrs?: JSONContent }> {
	if (doc.type === "text" && doc.text?.includes(text) === true) {
		return doc.marks ?? [];
	}

	for (const child of doc.content ?? []) {
		const found = marksOn(child, text);
		if (found.length > 0) {
			return found;
		}
	}

	return [];
}

test.describe("website spotlight articles admin", () => {
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
		await db.cleanupWorkerSpotlightArticles(testInfo.workerIndex);
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	test("should create a spotlight article", async ({ createWebsiteSpotlightArticlesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Test SA ${randomUUID()}`;
		const summary = "E2E test spotlight article summary";
		const content = `E2E spotlight article content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();

		await spotlightArticlesPage.gotoCreate();

		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary(summary);
		await spotlightArticlesPage.fillPublicationDate(2025, 1, 15);
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock(content);

		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getSpotlightArticleByTitle(title);
		expect(created).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2025-01-15T00:00:00.000Z"),
			summary,
		});
		const contentBlocks = await db.getSpotlightArticleContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);
	});

	test("should edit a spotlight article title", async ({
		page,
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const originalTitle = `${spotlightArticlesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(originalTitle);
		await spotlightArticlesPage.fillSummary("E2E test spotlight article to be edited");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock("Old spotlight article content");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(originalTitle);
		const row = spotlightArticlesPage.rowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${spotlightArticlesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E spotlight article summary";
		const updatedContent = `Updated spotlight article content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		await page.getByLabel("Title").fill(updatedTitle);
		await spotlightArticlesPage.fillSummary(updatedSummary);
		await spotlightArticlesPage.fillPublicationDate(2026, 2, 16);
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.updateContentBlockText(updatedContent);

		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(updatedTitle);
		await expect(spotlightArticlesPage.rowByTitle(updatedTitle)).toBeVisible();
		await spotlightArticlesPage.searchByTitle(originalTitle);
		await expect(spotlightArticlesPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getSpotlightArticleByTitle(updatedTitle);
		expect(updated).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2026-02-16T00:00:00.000Z"),
			summary: updatedSummary,
		});
		const contentBlocks = await db.getSpotlightArticleContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional spotlight article content blocks", async ({
		page,
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);
		const title = `${spotlightArticlesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("Spotlight article with content to clear");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock("Optional spotlight article content");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		const row = spotlightArticlesPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
		await spotlightArticlesPage.removeFirstContentBlock();
		await spotlightArticlesPage.submitForm();

		expect(await db.getSpotlightArticleContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should show contributors on the details screen", async ({
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		/**
		 * Two contributors whose insertion order is the reverse of their sort order, so the assertion
		 * below pins the `sortName` ordering rather than passing on insertion order by accident.
		 */
		const lastPerson = {
			name: `${spotlightArticlesPage.workerPrefix} Zeta Contributor ${randomUUID()}`,
			slug: `e2e-spotlight-contributor-zeta-${randomUUID()}`,
		};
		const firstPerson = {
			name: `${spotlightArticlesPage.workerPrefix} Alpha Contributor ${randomUUID()}`,
			slug: `e2e-spotlight-contributor-alpha-${randomUUID()}`,
		};
		await db.createPublishedPerson({
			name: lastPerson.name,
			sortName: `${spotlightArticlesPage.workerPrefix} Zzz ${randomUUID()}`,
			slug: lastPerson.slug,
		});
		await db.createPublishedPerson({
			name: firstPerson.name,
			sortName: `${spotlightArticlesPage.workerPrefix} Aaa ${randomUUID()}`,
			slug: firstPerson.slug,
		});

		const title = `${spotlightArticlesPage.workerPrefix} Contributors ${randomUUID()}`;
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("E2E spotlight article with contributors");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		await spotlightArticlesPage.gotoDetailsFromList(title);

		// The row is rendered even with no contributors, so its absence would fail here rather than
		// silently passing the assertions below.
		await expect(spotlightArticlesPage.detailsContributors()).toBeEmpty();

		await spotlightArticlesPage.gotoEditFromDetails();
		await spotlightArticlesPage.goToContributorsTab();
		await spotlightArticlesPage.addContributor(lastPerson.name, "Author");
		await spotlightArticlesPage.addContributor(firstPerson.name, "Editor");

		await spotlightArticlesPage.goto();
		await spotlightArticlesPage.searchByTitle(title);
		await spotlightArticlesPage.gotoDetailsFromList(title);

		const contributors = spotlightArticlesPage.detailsContributors().getByRole("listitem");
		await expect(contributors).toHaveCount(2);
		await expect(contributors.nth(0)).toContainText(firstPerson.name);
		await expect(contributors.nth(1)).toContainText(lastPerson.name);

		await expect(spotlightArticlesPage.detailsContributor(lastPerson.name)).toContainText("author");
		await expect(spotlightArticlesPage.detailsContributor(firstPerson.name)).toContainText(
			"editor",
		);

		// The link proves the person's slug was resolved from the contributor edge, not just the name.
		await expect(spotlightArticlesPage.detailsContributorLink(firstPerson.name)).toHaveAttribute(
			"href",
			new RegExp(`/dashboard/administrator/persons/${firstPerson.slug}/details$`),
		);
	});

	/**
	 * A table's caption is stored on the table node rather than inside it — `prosemirror-tables`
	 * reads a table's children as its rows — which puts it on the same footing as the image and embed
	 * captions: a richtext document living in an attribute, outside the document walk that carries
	 * everything else. Attributes are exactly what the image `layout` regression lost on a load/save
	 * cycle, so the round trip is the point of this test, not the authoring.
	 *
	 * Spotlight articles rather than news, because footnotes are enabled here — and a caption takes
	 * footnotes wherever its article does.
	 */
	test("should preserve a table caption's formatting, link and footnote across an edit round trip", async ({
		createWebsiteSpotlightArticlesPage,
		db,
	}) => {
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(test.info().workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Table Caption ${randomUUID()}`;
		const headers: [string, string] = [`Term ${randomUUID()}`, `Meaning ${randomUUID()}`];
		const boldPrefix = `Table 1 ${randomUUID()}:`;
		const linkText = `the report ${randomUUID()}`;
		const linkUrl = "https://example.com/report";
		const footnote = `Figures as of 2026 ${randomUUID()}`;

		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("E2E test spotlight article with a captioned table");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.addContentBlock(`Caption intro ${randomUUID()}`);

		await spotlightArticlesPage.insertTableAtEnd(headers);
		await spotlightArticlesPage.addTableCaption({ boldPrefix, linkText, linkUrl, footnote });
		await spotlightArticlesPage.expectTableCaption({ boldPrefix, linkText, linkUrl });

		await spotlightArticlesPage.submitForm();

		const assertStoredCaption = async () => {
			const contentBlocks = await db.getSpotlightArticleContentBlocksByTitle(title);
			expect(contentBlocks.map(({ type }) => type)).toStrictEqual(["rich_text"]);

			const stored = contentBlocks[0]!.content as JSONContent;
			const table = findNode(stored, "table");
			expect(table).toBeDefined();
			expect(JSON.stringify(table)).toContain(headers[0]);

			/**
			 * Asserted on the stored document rather than on rendered markup: the `<caption>` a reader
			 * gets is assembled from this attribute, and a caption flattened to the plain text that
			 * `renderHTML` writes would still render as a caption while having lost every mark in it.
			 */
			const caption = table?.attrs?.caption as JSONContent | null | undefined;
			expect(caption).toBeDefined();

			expect(marksOn(caption!, boldPrefix).map(({ type }) => type)).toContain("bold");

			const link = marksOn(caption!, linkText).find(({ type }) => type === "link");
			expect(link?.attrs).toMatchObject({ href: linkUrl });

			/** A marker keeps its note in an attribute of its own, so the note is what proves it kept. */
			const marker = findNode(caption!, "footnote");
			expect(JSON.stringify(marker?.attrs?.content)).toContain(footnote);
		};

		await assertStoredCaption();

		/** Re-open and save untouched: the half of the round trip that dropped image `layout`. */
		await spotlightArticlesPage.searchByTitle(title);
		await spotlightArticlesPage.gotoDetailsFromList(title);
		await spotlightArticlesPage.gotoEditFromDetails();

		/** The editor rebuilds the caption from the stored attribute, marks and marker included. */
		await spotlightArticlesPage.expectTableCaption({ boldPrefix, linkText, linkUrl });

		await spotlightArticlesPage.submitForm();

		await assertStoredCaption();
	});

	test("should delete a spotlight article", async ({ createWebsiteSpotlightArticlesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const spotlightArticlesPage = createWebsiteSpotlightArticlesPage(workerIndex);

		const title = `${spotlightArticlesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await spotlightArticlesPage.gotoCreate();
		await spotlightArticlesPage.fillTitle(title);
		await spotlightArticlesPage.fillSummary("E2E test spotlight article to be deleted");
		await spotlightArticlesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await spotlightArticlesPage.submitForm();

		await spotlightArticlesPage.searchByTitle(title);
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getSpotlightArticleByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await spotlightArticlesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await spotlightArticlesPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(spotlightArticlesPage.rowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getSpotlightArticleByTitle(title)).toBeNull();
	});
});
