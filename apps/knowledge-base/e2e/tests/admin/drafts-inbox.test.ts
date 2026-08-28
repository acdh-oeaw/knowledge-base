import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

const DRAFTS_PATH = "/en/dashboard/administrator/drafts";

/**
 * Narrow the inbox to a single type so the row set stays small and the just-touched draft (the list
 * is newest-edited-first by default) is on the first page — robust against the table paginating at
 * `dashboardPageSize`. NOTE: the trigger's accessible name comes from the Select's `aria-label`.
 */
async function filterDraftsByType(page: Page, typeLabel: string): Promise<void> {
	await page.getByRole("button", { name: /Filter by type/i }).click();
	await page.getByRole("option", { name: typeLabel, exact: true }).click();
}

/**
 * The administrator drafts inbox (`/dashboard/administrator/drafts`) lists every document with
 * unpublished work — brand-new drafts and changes layered on a published version — with a link to
 * each entity's details page (where the publish/discard lifecycle bar lives). Exercised with
 * persons since they have a simple admin create/lifecycle flow; the listing query is entity-type
 * agnostic.
 */
test.describe("administrator drafts inbox", () => {
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		// `selectImageFromMediaLibrary` needs the seeded asset present.
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	test("lists a new draft and links to its details page", async ({
		page,
		createAdminPersonsPage,
	}) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);
		const name = `${personsPage.workerPrefix} Drafts Inbox New ${randomUUID()}`;

		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Inbox, New");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.submitForm();

		await page.goto(DRAFTS_PATH);
		await filterDraftsByType(page, "persons");

		const row = page.getByRole("row").filter({ hasText: name });
		await expect(row).toBeVisible();
		await expect(row.getByText("New draft")).toBeVisible();

		// The name links to the entity's details page — the review entry point.
		await row.getByRole("link", { name }).click();
		await expect(page).toHaveURL(/\/administrator\/persons\/.+\/details/);
	});

	test("shows unpublished changes as 'Draft changes' and drops the entry once published", async ({
		page,
		createAdminPersonsPage,
	}) => {
		const personsPage = createAdminPersonsPage(test.info().workerIndex);
		const name = `${personsPage.workerPrefix} Drafts Inbox Changes ${randomUUID()}`;

		// Create then publish — a clean published document must NOT appear in the inbox.
		await personsPage.gotoCreate();
		await personsPage.fillName(name);
		await personsPage.fillSortName("Inbox, Changes");
		await personsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await personsPage.submitForm();
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.publishItem();

		await page.goto(DRAFTS_PATH);
		await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);

		// Edit the published person → creates a draft on top of the published version.
		await personsPage.goto();
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.gotoEditFromDetails();
		const sortName = page.getByLabel("Sort name");
		await sortName.clear();
		await sortName.fill("Inbox, Edited");
		await personsPage.submitForm();

		// Now listed as "Draft changes".
		await page.goto(DRAFTS_PATH);
		await filterDraftsByType(page, "persons");
		const row = page.getByRole("row").filter({ hasText: name });
		await expect(row).toBeVisible();
		await expect(row.getByText("Draft changes")).toBeVisible();

		// Publishing the changes clears it from the inbox.
		await personsPage.goto();
		await personsPage.searchByName(name);
		await personsPage.gotoDetailsFromList(name);
		await personsPage.publishItem();

		await page.goto(DRAFTS_PATH);
		await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
	});
});
