import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { AdminPersonsPage } from "@/e2e/lib/fixtures/admin-persons-page";
import { expect, test } from "@/e2e/lib/test";

/**
 * Storage state of the seeded admin, used to review/publish a chair-created draft in a second
 * context.
 */
const ADMIN_STORAGE_STATE = join(import.meta.dirname, "../../.auth/admin.json");

/**
 * Delegated people management on the non-admin working-group dashboard
 * (`/dashboard/working-groups/<slug>/edit`, People tab). The `wgchair` persona is seeded as
 * `is_chair_of` the first published working group (see `seedReportingPersonas` in global-setup),
 * which is the same group `db.getWorkingGroupOption()` resolves — so the chair is authorized to
 * edit it.
 *
 * These cover the delegated, scope-authorized flow built on the shared `PersonRelationsSection`:
 * creating a draft person inline, linking them via a contribution, and editing a person's metadata
 * as a draft. Publishing the person remains admin-only.
 *
 * NOTE: selectors for the role `Select`, the person `AsyncSelect`, and the date pickers mirror the
 * admin working-groups page object (`e2e/lib/fixtures/admin-working-groups-page.ts`); validate them
 * on first run if the UI primitives change.
 */
test.describe("working group people (delegated chair)", () => {
	test.describe.configure({ mode: "default" });

	let slug: string;
	let workingGroupVersionId: string;

	test.beforeAll(async ({ db }) => {
		const workingGroup = await db.getWorkingGroupOption();
		slug = workingGroup.slug;
		const versionId = await db.getPublishedVersionId(workingGroup.id);
		expect(versionId, "the chair's working group must be published").not.toBeNull();
		workingGroupVersionId = versionId!;
	});

	test.afterAll(async ({ db }, testInfo) => {
		// Removes the worker-prefixed draft persons (and their relations) created below.
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	/**
	 * Opens the People tab, creates a new draft person via the dialog, then links them with
	 * `roleName`.
	 */
	async function createAndLinkPerson(
		page: Page,
		input: Readonly<{ name: string; sortName: string; roleName: string }>,
	): Promise<void> {
		await page.goto(`/en/dashboard/working-groups/${slug}/edit`);
		await page.getByRole("tab", { name: "People" }).click();

		// Create a brand-new (draft) person; on success the dialog closes and the person is auto-selected
		// in the "Add person" form's picker.
		await page.getByRole("button", { name: "Add new person" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new person" });
		await dialog.getByLabel("Name", { exact: true }).fill(input.name);
		await dialog.getByRole("textbox", { name: "Sort name" }).fill(input.sortName);
		await dialog.getByRole("button", { name: "Add person" }).click();
		await dialog.waitFor({ state: "hidden" });

		// Pick the role.
		const roleControl = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Role", { exact: true }) });
		await roleControl.locator("button").click();
		await page.getByRole("option", { name: input.roleName, exact: true }).click();

		// Fill the required start date, scoped to the "Add person" form.
		const form = page
			.locator("form")
			.filter({ has: page.getByRole("button", { name: "Add person" }) });
		const startDate = form.getByRole("group", { name: "Start date" });
		await startDate.getByRole("spinbutton", { name: /day/i }).click();
		await page.keyboard.type("01");
		await startDate.getByRole("spinbutton", { name: /month/i }).click();
		await page.keyboard.type("01");
		await startDate.getByRole("spinbutton", { name: /year/i }).click();
		await page.keyboard.type("2020");

		await waitForActionSuccess({
			page,
			trigger: async () => {
				await page.getByRole("button", { name: "Add person" }).click();
			},
		});
	}

	test("creates a draft person and links them as a chair", async ({ page, db }, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Chair Person ${randomUUID()}`;
		const sortName = `${prefix}, Chair Person`;

		await createAndLinkPerson(page, { name, sortName, roleName: "is chair of" });

		const person = await db.getPersonByName(name);
		expect(person, "the created person exists").not.toBeNull();

		// The delegated create never publishes — the person is a draft (no published version).
		expect(await db.getPublishedVersionId(person!.documentId)).toBeNull();

		// The contribution relation is live (document-level), pointing at the draft person.
		const relations = await db.getPersonRelationsByUnitVersionId(workingGroupVersionId);
		expect(
			relations.some(
				(relation) =>
					relation.personId === person!.documentId && relation.roleType === "is_chair_of",
			),
		).toBe(true);
	});

	test("edits a person's metadata as a draft", async ({ page, db }, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Typo Persoon ${randomUUID()}`;
		const sortName = `${prefix}, Typo`;
		const correctedName = name.replace("Persoon", "Person");

		await createAndLinkPerson(page, { name, sortName, roleName: "is contact for" });

		// Fix the typo via the row's "Edit person" action.
		const peopleTable = page.getByRole("grid", { name: "people" });
		await peopleTable
			.getByRole("row")
			.filter({ hasText: name })
			.getByRole("button", { name: "Open actions menu" })
			.click();
		await page.getByRole("menuitem", { name: "Edit person", exact: true }).click();

		const dialog = page.getByRole("dialog", { name: "Edit person" });
		const nameField = dialog.getByLabel("Name", { exact: true });
		await nameField.fill(correctedName);
		await waitForActionSuccess({
			page,
			trigger: async () => {
				await dialog.getByRole("button", { name: "Save" }).click();
			},
		});

		// The correction is saved on the draft and the person remains unpublished.
		const corrected = await db.getPersonByName(correctedName);
		expect(corrected, "the corrected person exists").not.toBeNull();
		expect(await db.getPublishedVersionId(corrected!.documentId)).toBeNull();
		expect(await db.getPersonByName(name)).toBeNull();
	});

	test("offers a chair-created draft person in the picker after reload", async ({
		page,
		db,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const token = randomUUID();
		const name = `${prefix} Findable Draft ${token}`;
		const sortName = `${prefix}, Findable`;

		await page.goto(`/en/dashboard/working-groups/${slug}/edit`);
		await page.getByRole("tab", { name: "People" }).click();

		// Create the draft person but do NOT link them — the create alone persists the draft document.
		await page.getByRole("button", { name: "Add new person" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new person" });
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await dialog.getByRole("textbox", { name: "Sort name" }).fill(sortName);
		await waitForActionSuccess({
			page,
			trigger: async () => {
				await dialog.getByRole("button", { name: "Add person" }).click();
			},
		});
		await dialog.waitFor({ state: "hidden" });

		// Reload to drop the in-memory selection, then confirm the picker (which opts into draft persons
		// on delegated dashboards) finds the draft by search — exactly what a published-only picker hides.
		await page.reload();
		await page.getByRole("tab", { name: "People" }).click();
		const form = page
			.locator("form")
			.filter({ has: page.getByRole("button", { name: "Add person" }) });
		await form.getByRole("button", { name: "No person selected" }).click();
		await page.keyboard.type(token);
		await expect(page.getByRole("option").filter({ hasText: token })).toBeVisible();

		const person = await db.getPersonByName(name);
		expect(person, "the draft person exists").not.toBeNull();
		expect(await db.getPublishedVersionId(person!.documentId)).toBeNull();
	});

	test("lets an admin publish a chair-created draft person, preserving data and relation", async ({
		page,
		db,
		browser,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Publishable Person ${randomUUID()}`;
		const sortName = `${prefix}, Publishable`;

		await createAndLinkPerson(page, { name, sortName, roleName: "is chair of" });

		const person = await db.getPersonByName(name);
		expect(person, "the created person exists").not.toBeNull();
		expect(await db.getPublishedVersionId(person!.documentId)).toBeNull();

		// In a second context as the seeded admin, review and publish the chair's draft person.
		const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
		try {
			const adminPage = await adminContext.newPage();
			const adminPersons = new AdminPersonsPage(adminPage, testInfo.workerIndex);
			await adminPersons.goto();
			await adminPersons.searchByName(name);
			await adminPersons.gotoDetailsFromList(name);
			await adminPersons.publishItem();
		} finally {
			await adminContext.close();
		}

		// Publishing promoted exactly the chair's draft: the person is now published with the chair's
		// name intact, and the document-level chair relation is undisturbed.
		expect(await db.getPublishedVersionId(person!.documentId)).not.toBeNull();
		expect(await db.getPersonByName(name)).not.toBeNull();
		const relations = await db.getPersonRelationsByUnitVersionId(workingGroupVersionId);
		expect(
			relations.some(
				(relation) =>
					relation.personId === person!.documentId && relation.roleType === "is_chair_of",
			),
		).toBe(true);
	});
});
