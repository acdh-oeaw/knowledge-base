import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("users admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerUsers(testInfo.workerIndex);
	});

	test("should create a user", async ({ createAdminUsersPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);

		const name = `${usersPage.workerPrefix} Test User ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+${randomUUID()}@example.com`;

		await usersPage.gotoCreate();

		await usersPage.fillName(name);
		await usersPage.fillEmail(email);
		await usersPage.fillPassword("TestPassword123!");

		await usersPage.submitForm();

		await usersPage.searchByName(name);
		await expect(usersPage.rowByName(name)).toBeVisible();

		const created = await db.getUserByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({
			canManageAdmins: false,
			email,
			name,
			organisationalUnitId: null,
			personId: null,
			role: "user",
		});
	});

	test("should edit all user form fields", async ({ page, createAdminUsersPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);

		const originalName = `${usersPage.workerPrefix} Edit Me ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+${randomUUID()}@example.com`;

		await usersPage.gotoCreate();
		await usersPage.fillName(originalName);
		await usersPage.fillEmail(email);
		await usersPage.fillPassword("TestPassword123!");
		await usersPage.submitForm();

		await usersPage.searchByName(originalName);
		const row = usersPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${usersPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedEmail = `e2e-worker-${String(workerIndex)}+updated-${randomUUID()}@example.com`;

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await usersPage.fillEmail(updatedEmail);
		await usersPage.submitForm();

		await usersPage.searchByName(updatedName);
		await expect(usersPage.rowByName(updatedName)).toBeVisible();
		await usersPage.searchByName(originalName);
		await expect(usersPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getUserByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			canManageAdmins: false,
			email: updatedEmail,
			name: updatedName,
			organisationalUnitId: null,
			personId: null,
			role: "user",
		});
	});

	test("should clear optional user actor and admin fields", async ({
		page,
		createAdminUsersPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);
		const person = await db.getPersonOption();
		const originalName = `${usersPage.workerPrefix} Clear Optional ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+clear-${randomUUID()}@example.com`;

		await usersPage.gotoCreate();
		await usersPage.fillName(originalName);
		await usersPage.fillEmail(email);
		await usersPage.selectRole("Admin");
		await usersPage.setCanManageAdmins();
		await usersPage.fillPassword("TestPassword123!");
		await usersPage.selectPersonActor(person.name);
		await usersPage.submitForm();

		await usersPage.searchByName(originalName);
		const row = usersPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${usersPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await usersPage.selectRole("User");
		await usersPage.selectActorType("None");
		await usersPage.submitForm();

		const updated = await db.getUserByName(updatedName);
		expect(updated).toMatchObject({
			canManageAdmins: false,
			organisationalUnitId: null,
			personId: null,
			role: "user",
		});
	});

	test("should delete a user", async ({ createAdminUsersPage }) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);

		const name = `${usersPage.workerPrefix} Delete Me ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+${randomUUID()}@example.com`;

		await usersPage.gotoCreate();
		await usersPage.fillName(name);
		await usersPage.fillEmail(email);
		await usersPage.fillPassword("TestPassword123!");
		await usersPage.submitForm();

		await usersPage.searchByName(name);
		await expect(usersPage.rowByName(name)).toBeVisible();

		const deleteDialog = await usersPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await usersPage.confirmDelete(deleteDialog);

		await expect(usersPage.rowByName(name)).toBeHidden();
	});
});
