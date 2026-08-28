import { randomUUID } from "node:crypto";

import { expectDetailsTermsInOrder } from "@/e2e/lib/fixtures/details-order";
import { expect, test } from "@/e2e/lib/test";

test.describe("website impact case studies admin", () => {
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
		await db.cleanupWorkerImpactCaseStudies(testInfo.workerIndex);
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	test("should create an impact case study", async ({ createWebsiteImpactCaseStudiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const title = `${impactCaseStudiesPage.workerPrefix} Test ICS ${randomUUID()}`;
		const summary = "E2E test impact case study summary";
		const content = `E2E impact case study content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();

		await impactCaseStudiesPage.gotoCreate();

		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary(summary);
		await impactCaseStudiesPage.fillPublicationDate(2025, 1, 15);
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock(content);

		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getImpactCaseStudyByTitle(title);
		expect(created).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2025-01-15T00:00:00.000Z"),
			summary,
		});
		const contentBlocks = await db.getImpactCaseStudyContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		await impactCaseStudiesPage.gotoDetailsFromList(title);
		await expectDetailsTermsInOrder(impactCaseStudiesPage.page, [
			"Image",
			"Contributors",
			"Content",
			"Related entities",
			"Related resources",
		]);
	});

	test("should edit an impact case study title", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const originalTitle = `${impactCaseStudiesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(originalTitle);
		await impactCaseStudiesPage.fillSummary("E2E test impact case study to be edited");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock("Old impact case study content");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(originalTitle);
		const row = impactCaseStudiesPage.rowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${impactCaseStudiesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E impact case study summary";
		const updatedContent = `Updated impact case study content ${randomUUID()}`;
		const testAsset = await db.getTestAsset();
		await page.getByLabel("Title").fill(updatedTitle);
		await impactCaseStudiesPage.fillSummary(updatedSummary);
		await impactCaseStudiesPage.fillPublicationDate(2026, 2, 16);
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.updateContentBlockText(updatedContent);

		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(updatedTitle);
		await expect(impactCaseStudiesPage.rowByTitle(updatedTitle)).toBeVisible();
		await impactCaseStudiesPage.searchByTitle(originalTitle);
		await expect(impactCaseStudiesPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getImpactCaseStudyByTitle(updatedTitle);
		expect(updated).toMatchObject({
			imageId: testAsset.id,
			publicationDate: new Date("2026-02-16T00:00:00.000Z"),
			summary: updatedSummary,
		});
		const contentBlocks = await db.getImpactCaseStudyContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional impact case study content blocks", async ({
		page,
		createWebsiteImpactCaseStudiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);
		const title = `${impactCaseStudiesPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary("Impact case study with content to clear");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.addContentBlock("Optional impact case study content");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		const row = impactCaseStudiesPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
		await impactCaseStudiesPage.removeFirstContentBlock();
		await impactCaseStudiesPage.submitForm();

		expect(await db.getImpactCaseStudyContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should show contributors on the details screen", async ({
		createWebsiteImpactCaseStudiesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		/**
		 * Two contributors whose insertion order is the reverse of their sort order, so the assertion
		 * below pins the `sortName` ordering rather than passing on insertion order by accident.
		 */
		const lastPerson = {
			name: `${impactCaseStudiesPage.workerPrefix} Zeta Contributor ${randomUUID()}`,
			slug: `e2e-impact-contributor-zeta-${randomUUID()}`,
		};
		const firstPerson = {
			name: `${impactCaseStudiesPage.workerPrefix} Alpha Contributor ${randomUUID()}`,
			slug: `e2e-impact-contributor-alpha-${randomUUID()}`,
		};
		await db.createPublishedPerson({
			name: lastPerson.name,
			sortName: `${impactCaseStudiesPage.workerPrefix} Zzz ${randomUUID()}`,
			slug: lastPerson.slug,
		});
		await db.createPublishedPerson({
			name: firstPerson.name,
			sortName: `${impactCaseStudiesPage.workerPrefix} Aaa ${randomUUID()}`,
			slug: firstPerson.slug,
		});

		const title = `${impactCaseStudiesPage.workerPrefix} Contributors ${randomUUID()}`;
		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary("E2E impact case study with contributors");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		await impactCaseStudiesPage.gotoDetailsFromList(title);

		// The row is rendered even with no contributors, so its absence would fail here rather than
		// silently passing the assertions below.
		await expect(impactCaseStudiesPage.detailsContributors()).toBeEmpty();

		await impactCaseStudiesPage.gotoEditFromDetails();
		await impactCaseStudiesPage.goToContributorsTab();
		await impactCaseStudiesPage.addContributor(lastPerson.name, "Author");
		await impactCaseStudiesPage.addContributor(firstPerson.name, "Editor");

		await impactCaseStudiesPage.goto();
		await impactCaseStudiesPage.searchByTitle(title);
		await impactCaseStudiesPage.gotoDetailsFromList(title);

		const contributors = impactCaseStudiesPage.detailsContributors().getByRole("listitem");
		await expect(contributors).toHaveCount(2);
		await expect(contributors.nth(0)).toContainText(firstPerson.name);
		await expect(contributors.nth(1)).toContainText(lastPerson.name);

		await expect(impactCaseStudiesPage.detailsContributor(lastPerson.name)).toContainText("author");
		await expect(impactCaseStudiesPage.detailsContributor(firstPerson.name)).toContainText(
			"editor",
		);

		// The link proves the person's slug was resolved from the contributor edge, not just the name.
		await expect(impactCaseStudiesPage.detailsContributorLink(firstPerson.name)).toHaveAttribute(
			"href",
			new RegExp(`/dashboard/administrator/persons/${firstPerson.slug}/details$`),
		);
	});

	test("should delete an impact case study", async ({ createWebsiteImpactCaseStudiesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const impactCaseStudiesPage = createWebsiteImpactCaseStudiesPage(workerIndex);

		const title = `${impactCaseStudiesPage.workerPrefix} Delete Me ${randomUUID()}`;
		await impactCaseStudiesPage.gotoCreate();
		await impactCaseStudiesPage.fillTitle(title);
		await impactCaseStudiesPage.fillSummary("E2E test impact case study to be deleted");
		await impactCaseStudiesPage.selectImageFromMediaLibrary("E2E Test Asset");
		await impactCaseStudiesPage.submitForm();

		await impactCaseStudiesPage.searchByTitle(title);
		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeVisible();

		const created = await db.getImpactCaseStudyByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await impactCaseStudiesPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await impactCaseStudiesPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(impactCaseStudiesPage.rowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getImpactCaseStudyByTitle(title)).toBeNull();
	});
});
