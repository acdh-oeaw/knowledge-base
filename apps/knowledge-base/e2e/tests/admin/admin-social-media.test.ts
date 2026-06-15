import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("social media admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerSocialMedia(testInfo.workerIndex);
	});

	test("should create a social media entry", async ({ createAdminSocialMediaPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const socialMediaPage = createAdminSocialMediaPage(workerIndex);

		const name = `${socialMediaPage.workerPrefix} Test Social Media ${randomUUID()}`;
		const url = "https://example.com/social-media-create";

		await socialMediaPage.gotoCreate();

		await socialMediaPage.fillName(name);
		await socialMediaPage.fillUrl(url);
		await socialMediaPage.selectFirstType();
		await socialMediaPage.fillDatePicker("Start date", 2024, 1, 15);
		await socialMediaPage.fillDatePicker("End date", 2024, 12, 31);

		await socialMediaPage.submitForm();

		await socialMediaPage.searchByName(name);
		await expect(socialMediaPage.rowByName(name)).toBeVisible();

		const created = await db.getSocialMediaByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ name, url });
		expect(created?.type).toBeTruthy();
		expect(created?.duration?.start).toStrictEqual(new Date("2024-01-15T00:00:00.000Z"));
		expect(created?.duration?.end).toStrictEqual(new Date("2024-12-31T00:00:00.000Z"));
	});

	test("should edit all social media form fields", async ({
		page,
		createAdminSocialMediaPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const socialMediaPage = createAdminSocialMediaPage(workerIndex);

		const originalName = `${socialMediaPage.workerPrefix} Edit Me ${randomUUID()}`;

		await socialMediaPage.gotoCreate();
		await socialMediaPage.fillName(originalName);
		await socialMediaPage.fillUrl("https://example.com");
		await socialMediaPage.selectFirstType();
		await socialMediaPage.fillDatePicker("Start date", 2024, 1, 15);
		await socialMediaPage.fillDatePicker("End date", 2024, 12, 31);
		await socialMediaPage.submitForm();

		await socialMediaPage.searchByName(originalName);
		const row = socialMediaPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${socialMediaPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedUrl = "https://example.com/social-media-updated";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await socialMediaPage.fillUrl(updatedUrl);
		await socialMediaPage.selectFirstType();
		await socialMediaPage.fillDatePicker("Start date", 2025, 2, 16);
		await socialMediaPage.fillDatePicker("End date", 2025, 11, 30);

		await socialMediaPage.submitForm();

		await socialMediaPage.searchByName(updatedName);
		await expect(socialMediaPage.rowByName(updatedName)).toBeVisible();
		await socialMediaPage.searchByName(originalName);
		await expect(socialMediaPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getSocialMediaByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({ name: updatedName, url: updatedUrl });
		expect(updated?.type).toBeTruthy();
		expect(updated?.duration?.start).toStrictEqual(new Date("2025-02-16T00:00:00.000Z"));
		expect(updated?.duration?.end).toStrictEqual(new Date("2025-11-30T00:00:00.000Z"));
	});

	test("should clear optional social media dates", async ({
		page,
		createAdminSocialMediaPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const socialMediaPage = createAdminSocialMediaPage(workerIndex);
		const originalName = `${socialMediaPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await socialMediaPage.gotoCreate();
		await socialMediaPage.fillName(originalName);
		await socialMediaPage.fillUrl("https://example.com/social-clear");
		await socialMediaPage.selectFirstType();
		await socialMediaPage.fillDatePicker("Start date", 2024, 1, 15);
		await socialMediaPage.fillDatePicker("End date", 2024, 12, 31);
		await socialMediaPage.submitForm();

		await socialMediaPage.searchByName(originalName);
		const row = socialMediaPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${socialMediaPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await socialMediaPage.clearDatePicker("Start date");
		await socialMediaPage.clearDatePicker("End date");
		await socialMediaPage.submitForm();

		const updated = await db.getSocialMediaByName(updatedName);
		expect(updated?.duration).toBeNull();
	});

	test("should delete a social media entry", async ({ createAdminSocialMediaPage }) => {
		const workerIndex = test.info().workerIndex;
		const socialMediaPage = createAdminSocialMediaPage(workerIndex);

		const name = `${socialMediaPage.workerPrefix} Delete Me ${randomUUID()}`;

		await socialMediaPage.gotoCreate();
		await socialMediaPage.fillName(name);
		await socialMediaPage.fillUrl("https://example.com");
		await socialMediaPage.selectFirstType();
		await socialMediaPage.submitForm();

		await socialMediaPage.searchByName(name);
		await expect(socialMediaPage.rowByName(name)).toBeVisible();

		const deleteDialog = await socialMediaPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await socialMediaPage.confirmDelete(deleteDialog);

		await expect(socialMediaPage.rowByName(name)).toBeHidden();
	});
});
