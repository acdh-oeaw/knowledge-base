import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { expect, test } from "@/e2e/lib/test";

/**
 * Delegated people + institution management on the non-admin country dashboard
 * (`/dashboard/countries/<code>/edit`). The `nc` persona is seeded as `national_coordinator` of the
 * first published country (see `seedReportingPersonas`), which `db.getCountryOption()` resolves.
 *
 * People and partner institutions attach to the **country document** (matching the admin model),
 * while the Details tab edits the national consortium. Both are saved as drafts where versioned;
 * publishing stays admin-only.
 *
 * SEEDING PREREQUISITE: the country must have a national consortium (`is_national_consortium_of`)
 * and DARIAH ERIC must exist — otherwise the edit page `notFound()`s / hides the Institutions tab.
 * The `beforeAll` asserts the page is reachable so an unmet prerequisite fails loudly.
 *
 * NOTE: control selectors mirror the admin working-groups / reverse-relation page objects; validate
 * on first run if the UI primitives change.
 */
test.describe("country people and institutions (delegated national coordinator)", () => {
	test.describe.configure({ mode: "default" });

	let code: string;
	let countryDocumentId: string;
	let countryVersionId: string;

	test.beforeAll(async ({ db }) => {
		const country = await db.getCountryOption();
		code = country.slug;
		countryDocumentId = country.id;
		const versionId = await db.getPublishedVersionId(country.id);
		expect(versionId, "the coordinator's country must be published").not.toBeNull();
		countryVersionId = versionId!;
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPersons(testInfo.workerIndex);
		await db.cleanupWorkerInstitutions(testInfo.workerIndex);
	});

	async function gotoEdit(page: Page): Promise<void> {
		await page.goto(`/en/dashboard/countries/${code}/edit`);
		// Fails loudly if the consortium/ERIC prerequisite is unmet (the page would 404 instead).
		await expect(page.getByRole("tab", { name: "People" })).toBeVisible();
	}

	test("person tab: selects a freshly created draft person without reloading", async ({
		page,
		db,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Country Person ${randomUUID()}`;
		const sortName = `${prefix}, Country Person`;

		await gotoEdit(page);
		await page.getByRole("tab", { name: "People" }).click();

		await page.getByRole("button", { name: "Add new person" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new person" });
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await dialog.getByRole("textbox", { name: "Sort name" }).fill(sortName);
		await dialog.getByRole("button", { name: "Add person" }).click();
		await dialog.waitFor({ state: "hidden" });

		// Select the first allowed country role (avoids hard-coding the exact role set).
		const roleControl = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Role", { exact: true }) });
		await roleControl.locator("button").click();
		await page.getByRole("option").first().click();

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

		const person = await db.getPersonByName(name);
		expect(person, "the created person exists").not.toBeNull();
		expect(await db.getPublishedVersionId(person!.documentId)).toBeNull();

		// The relation targets the COUNTRY document, not the consortium.
		const relations = await db.getPersonRelationsByUnitVersionId(countryVersionId);
		expect(relations.some((relation) => relation.personId === person!.documentId)).toBe(true);
	});

	test("person tab: lists a freshly created draft person in the picker after reload", async ({
		page,
		db,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Reload Person ${randomUUID()}`;
		// A `0000`-prefixed sort name collates first under the db's en_US.utf8 collation, so the new
		// draft lands on the first page of the picker's options — which is capped and ordered by sort
		// name — regardless of how many other persons are seeded.
		const sortName = `0000 ${prefix} Reload Person`;

		await gotoEdit(page);
		await page.getByRole("tab", { name: "People" }).click();

		await page.getByRole("button", { name: "Add new person" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new person" });
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await dialog.getByRole("textbox", { name: "Sort name" }).fill(sortName);
		await dialog.getByRole("button", { name: "Add person" }).click();
		await dialog.waitFor({ state: "hidden" });

		const person = await db.getPersonByName(name);
		expect(person, "the created draft person exists").not.toBeNull();
		expect(await db.getPublishedVersionId(person!.documentId)).toBeNull();

		// Reload to discard the client-side selection and exercise the SERVER-rendered initial options.
		// Regression: the page server-fetched published persons only, so after a refresh the picker
		// dropped the just-created draft even though the (draft-aware) options api would still find it.
		await gotoEdit(page);
		await page.getByRole("tab", { name: "People" }).click();

		// Open the picker WITHOUT typing: searching would hit the draft-aware api and mask the bug,
		// which only affects the initial, server-provided option list.
		const personControl = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Person", { exact: true }) });
		await personControl.getByRole("button").first().click();

		const listbox = page.getByRole("listbox", { name: "Person" });
		await expect(listbox.getByRole("option", { name, exact: true })).toBeVisible();
	});

	test("institution tab: creates and links a freshly created draft institution without reloading", async ({
		page,
		db,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Partner Institution ${randomUUID()}`;

		await gotoEdit(page);
		await page.getByRole("tab", { name: "Institutions" }).click();

		// Create a new (draft) institution; the create action also adds the `is_located_in` edge and
		// selects it in the picker.
		await page.getByRole("button", { name: "Add new institution" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new institution" });
		await dialog.getByRole("textbox", { name: "Name" }).fill(name);
		await dialog.getByRole("button", { name: "Save" }).click();
		await dialog.waitFor({ state: "hidden" });

		// Choose the first partner status, fill the start date, and create the partner relation. The
		// status select renders because the ERIC↔institution reverse relation offers several statuses
		// (member / cooperating partner / partner institution / …).
		const statusControl = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Relation type", { exact: true }) });
		await statusControl.locator("button").click();
		await page.getByRole("option").first().click();

		const form = page
			.locator("form")
			.filter({ has: page.getByRole("button", { name: "Add institution" }) });
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
				await page.getByRole("button", { name: "Add institution" }).click();
			},
		});

		const institution = await db.getInstitutionByName(name);
		expect(institution, "the created institution exists").not.toBeNull();
		// Delegated create never publishes.
		expect(await db.getPublishedVersionId(institution!.documentId)).toBeNull();

		const relations = await db.getUnitRelationsBySourceDocumentId(institution!.documentId);
		// Located in the coordinator's country (added by the create action).
		expect(
			relations.some(
				(relation) =>
					relation.statusType === "is_located_in" &&
					relation.relatedUnitDocumentId === countryDocumentId,
			),
		).toBe(true);
		// A partner edge to DARIAH ERIC (some non-`is_located_in` relation to another unit).
		expect(
			relations.some(
				(relation) =>
					relation.statusType !== "is_located_in" &&
					relation.relatedUnitDocumentId !== countryDocumentId,
			),
		).toBe(true);
	});

	test("institution tab: lists a freshly created draft institution in the picker after reload", async ({
		page,
		db,
	}, testInfo) => {
		const prefix = `[e2e-worker-${String(testInfo.workerIndex)}]`;
		const name = `${prefix} Reload Institution ${randomUUID()}`;

		await gotoEdit(page);
		await page.getByRole("tab", { name: "Institutions" }).click();

		// Creating the draft institution also adds its `is_located_in` edge to the country, so it is in
		// scope for the country-scoped picker even without completing a partner relation.
		await page.getByRole("button", { name: "Add new institution" }).click();
		const dialog = page.getByRole("dialog", { name: "Add new institution" });
		await dialog.getByRole("textbox", { name: "Name" }).fill(name);
		await dialog.getByRole("button", { name: "Save" }).click();
		await dialog.waitFor({ state: "hidden" });

		const institution = await db.getInstitutionByName(name);
		expect(institution, "the created draft institution exists").not.toBeNull();
		expect(await db.getPublishedVersionId(institution!.documentId)).toBeNull();

		// Reload to drop the client-side selection. Unlike the person picker, this one always fetches
		// from the options api, so the regression here is the api filtering to published-only — a draft
		// institution the coordinator just created would vanish from the picker after a refresh.
		await gotoEdit(page);
		await page.getByRole("tab", { name: "Institutions" }).click();

		const institutionControl = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Institution", { exact: true }) });
		await institutionControl.getByRole("button").first().click();

		// Search by the unique name so the assertion is independent of how many institutions are located
		// in the country; the query still hits the draft-aware, country-scoped options api. The picker's
		// search input is autofocused when the popover opens, so typing lands there.
		const listbox = page.getByRole("listbox", { name: "Institution" });
		await listbox.waitFor();
		await page.keyboard.type(name);
		await expect(listbox.getByRole("option", { name, exact: true })).toBeVisible();
	});
});
