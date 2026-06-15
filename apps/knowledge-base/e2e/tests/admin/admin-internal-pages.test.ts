import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("internal pages admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 *
	 * Unlike other admin tests, internal pages are pre-seeded and have no create/delete actions. The
	 * edit test borrows an existing page and the afterAll discards the resulting draft to restore the
	 * published state.
	 */
	test.describe.configure({ mode: "default" });

	let editedPageDocumentId: string | null = null;

	test.afterAll(async ({ db }) => {
		if (editedPageDocumentId != null) {
			await db.discardInternalPageDraft(editedPageDocumentId);
		}
	});

	test("should list internal pages", async ({ createAdminInternalPagesPage }) => {
		const internalPagesPage = createAdminInternalPagesPage();

		await internalPagesPage.goto();

		await expect(internalPagesPage.page.getByRole("grid")).toBeVisible();
		await expect(internalPagesPage.page.getByRole("row").nth(1)).toBeVisible();
	});

	test("should edit an internal page title", async ({ createAdminInternalPagesPage, db }) => {
		const internalPagesPage = createAdminInternalPagesPage();

		const internalPage = await db.getFirstInternalPage();
		expect(internalPage).not.toBeNull();

		editedPageDocumentId = internalPage!.documentId;

		await internalPagesPage.gotoEdit(internalPage!.slug);

		const updatedTitle = `E2E Test Internal Page ${randomUUID()}`;
		await internalPagesPage.fillTitle(updatedTitle);
		await internalPagesPage.submitForm();

		await internalPagesPage.searchByTitle(updatedTitle);
		await expect(internalPagesPage.rowByTitle(updatedTitle)).toBeVisible();

		const updated = await db.getInternalPageByTitle(updatedTitle);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({ title: updatedTitle });
	});
});
