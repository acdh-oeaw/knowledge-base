import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

test.describe("services admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerServices(testInfo.workerIndex);
	});

	test("should create a service", async ({ createAdminServicesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const servicesPage = createAdminServicesPage(workerIndex);

		const name = `${servicesPage.workerPrefix} Test Service ${randomUUID()}`;
		const comment = "E2E test service comment.";
		await servicesPage.gotoCreate();

		await servicesPage.fillName(name);
		await servicesPage.selectFirstStatus();
		await servicesPage.fillComment(comment);
		await servicesPage.setFlag("dariahBranding");
		await servicesPage.setFlag("monitoring");
		await servicesPage.setFlag("privateSupplier");

		await servicesPage.submitForm();

		await servicesPage.searchByName(name);
		await expect(servicesPage.rowByName(name)).toBeVisible();

		const created = await db.getServiceByName(name);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({
			comment,
			dariahBranding: true,
			metadata: {},
			monitoring: true,
			name,
			privateSupplier: true,
		});
		expect(created?.statusId).toBeTruthy();
	});

	test("should edit all service form fields", async ({ page, createAdminServicesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const servicesPage = createAdminServicesPage(workerIndex);

		const originalName = `${servicesPage.workerPrefix} Edit Me ${randomUUID()}`;
		await servicesPage.gotoCreate();
		await servicesPage.fillName(originalName);
		await servicesPage.selectFirstStatus();
		await servicesPage.fillComment("Old E2E service comment.");
		await servicesPage.submitForm();

		await servicesPage.searchByName(originalName);
		const row = servicesPage.rowByName(originalName);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${servicesPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedComment = "Updated E2E service comment.";

		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await servicesPage.selectFirstStatus();
		await servicesPage.fillComment(updatedComment);
		await servicesPage.setFlag("dariahBranding");
		await servicesPage.setFlag("monitoring");
		await servicesPage.setFlag("privateSupplier");

		await servicesPage.submitForm();

		await servicesPage.searchByName(updatedName);
		await expect(servicesPage.rowByName(updatedName)).toBeVisible();
		await servicesPage.searchByName(originalName);
		await expect(servicesPage.rowByName(originalName)).toBeHidden();

		const updated = await db.getServiceByName(updatedName);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({
			comment: updatedComment,
			dariahBranding: true,
			metadata: {},
			monitoring: true,
			name: updatedName,
			privateSupplier: true,
		});
		expect(updated?.statusId).toBeTruthy();
	});

	test("should persist service owner and provider fields", async ({
		page,
		createAdminServicesPage,
		db,
	}) => {
		const workerIndex = test.info().workerIndex;
		const servicesPage = createAdminServicesPage(workerIndex);
		const originalName = `${servicesPage.workerPrefix} Relations ${randomUUID()}`;
		const organisationalUnits = await db.getOrganisationalUnitOptions(2);
		expect(organisationalUnits).toHaveLength(2);
		const [ownerUnit, providerUnit] = organisationalUnits as [
			{ documentId: string; name: string },
			{ documentId: string; name: string },
		];

		await servicesPage.gotoCreate();
		await servicesPage.fillName(originalName);
		await servicesPage.selectFirstStatus();
		await servicesPage.submitForm();

		await servicesPage.searchByName(originalName);
		const row = servicesPage.rowByName(originalName);
		await expect(row).toBeVisible();
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${servicesPage.workerPrefix} Relations Updated ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await servicesPage.selectServiceOwner(ownerUnit.name);
		await servicesPage.selectServiceProvider(providerUnit.name);
		await servicesPage.submitForm();

		const updated = await db.getServiceByName(updatedName);
		expect(updated).toMatchObject({
			ownerUnitDocumentIds: [ownerUnit.documentId],
			providerUnitDocumentIds: [providerUnit.documentId],
		});
	});

	test("should clear optional service fields", async ({ page, createAdminServicesPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const servicesPage = createAdminServicesPage(workerIndex);
		const originalName = `${servicesPage.workerPrefix} Clear Optional ${randomUUID()}`;
		const organisationalUnits = await db.getOrganisationalUnitOptions(2);
		expect(organisationalUnits).toHaveLength(2);
		const [ownerUnit, providerUnit] = organisationalUnits as [
			{ documentId: string; name: string },
			{ documentId: string; name: string },
		];

		await servicesPage.gotoCreate();
		await servicesPage.fillName(originalName);
		await servicesPage.selectFirstStatus();
		await servicesPage.fillComment("Optional comment to clear.");
		await servicesPage.selectServiceOwner(ownerUnit.name);
		await servicesPage.selectServiceProvider(providerUnit.name);
		await servicesPage.setFlag("dariahBranding");
		await servicesPage.setFlag("monitoring");
		await servicesPage.setFlag("privateSupplier");
		await servicesPage.submitForm();

		await servicesPage.searchByName(originalName);
		const row = servicesPage.rowByName(originalName);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedName = `${servicesPage.workerPrefix} Cleared ${randomUUID()}`;
		await page.getByLabel("Name", { exact: true }).fill(updatedName);
		await servicesPage.fillComment("");
		await servicesPage.unsetFlag("dariahBranding");
		await servicesPage.unsetFlag("monitoring");
		await servicesPage.unsetFlag("privateSupplier");
		await servicesPage.removeSelectedOrganisationalUnits("Service owners");
		await servicesPage.removeSelectedOrganisationalUnits("Service providers");
		await servicesPage.submitForm();

		const updated = await db.getServiceByName(updatedName);
		expect(updated).toMatchObject({
			comment: null,
			dariahBranding: false,
			monitoring: false,
			ownerUnitDocumentIds: [],
			privateSupplier: false,
			providerUnitDocumentIds: [],
		});
	});

	test("should delete a service", async ({ createAdminServicesPage }) => {
		const workerIndex = test.info().workerIndex;
		const servicesPage = createAdminServicesPage(workerIndex);

		const name = `${servicesPage.workerPrefix} Delete Me ${randomUUID()}`;

		await servicesPage.gotoCreate();
		await servicesPage.fillName(name);
		await servicesPage.selectFirstStatus();
		await servicesPage.submitForm();

		await servicesPage.searchByName(name);
		await expect(servicesPage.rowByName(name)).toBeVisible();

		const deleteDialog = await servicesPage.openDeleteDialog(name);
		await expect(deleteDialog).toBeVisible();
		await servicesPage.confirmDelete(deleteDialog);

		await expect(servicesPage.rowByName(name)).toBeHidden();
	});
});
