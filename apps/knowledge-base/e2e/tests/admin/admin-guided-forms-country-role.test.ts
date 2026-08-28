import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

/**
 * Appointing someone to a country role is two rows, not one: the role itself and the seat on the
 * governance body that comes with it, over the same period. `pairedRelationRules` reports a missing
 * or mismatched counterpart after the fact; these tests check the wizard writes both, against the
 * right body, before that check ever has to run.
 *
 * Each test creates its own person. The seed has two published persons and global setup already
 * gives them committee relations, so reusing one would land on the "already recorded" path.
 */

const BASE_PATH = "/en/dashboard/administrator/guided-forms/country-role";

async function fillDatePicker(
	page: Page,
	label: string,
	year: number,
	month: number,
	day: number,
): Promise<void> {
	const group = page.getByRole("group", { name: label });
	await group.getByRole("spinbutton", { name: /day/i }).click();
	await page.keyboard.type(String(day).padStart(2, "0"));
	await group.getByRole("spinbutton", { name: /month/i }).click();
	await page.keyboard.type(String(month).padStart(2, "0"));
	await group.getByRole("spinbutton", { name: /year/i }).click();
	await page.keyboard.type(String(year));
}

async function selectAsyncOption(
	page: Page,
	triggerName: string,
	searchText: string,
): Promise<void> {
	await page.getByRole("button", { name: triggerName }).click();
	const search = page.getByRole("dialog", { name: triggerName }).getByRole("searchbox");
	await search.fill(searchText);
	await search.press("Enter");
	const option = page.getByRole("option").first();
	await option.waitFor({ state: "visible" });
	await option.click();
}

/**
 * Submits and waits for the wizard's success screen.
 *
 * The success message is the only signal that the transaction actually committed: the POST response
 * arrives while the client transition is still running, so asserting on database rows straight
 * after it reads the state from before the write.
 */
async function submitAndWait(page: Page, buttonName: string, successText: string): Promise<void> {
	await page.getByRole("button", { name: buttonName, exact: true }).click();
	await expect(page.getByText(successText)).toBeVisible();
}

/** Drives the start mode as far as the review step. */
async function fillAppointment(
	page: Page,
	params: { personName: string; countryName: string; role: string; counterpartRole?: string },
): Promise<void> {
	await page.goto(BASE_PATH);

	await selectAsyncOption(page, "No person selected", params.personName);
	await page.getByRole("button", { name: "Continue" }).click();

	await selectAsyncOption(page, "No country selected", params.countryName);

	await page.getByRole("button", { name: "Role" }).click();
	await page.getByRole("option", { name: params.role, exact: true }).click();

	if (params.counterpartRole != null) {
		await page.getByRole("button", { name: "Role on the governance body" }).click();
		await page.getByRole("option", { name: params.counterpartRole, exact: true }).click();
	}

	await fillDatePicker(page, "From", 2026, 1, 1);
	await page.getByRole("button", { name: "Review" }).click();
}

test.describe("guided forms - country role", () => {
	test.describe.configure({ mode: "default" });

	let countryName: string;
	let countryDocumentId: string;

	test.beforeAll(async ({ db }) => {
		const country = await db.getFirstPublishedCountry();
		if (country == null) {
			throw new Error("No published country to appoint anyone in.");
		}
		countryName = country.name;
		countryDocumentId = country.documentId;
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	async function createPerson(
		db: {
			createPublishedPerson: (params: {
				name: string;
				sortName: string;
				slug: string;
			}) => Promise<{ documentId: string }>;
		},
		label: string,
	): Promise<{ name: string; documentId: string }> {
		const name = `[e2e-worker-${String(test.info().workerIndex)}] ${label} ${randomUUID()}`;
		const person = await db.createPublishedPerson({
			name,
			sortName: name,
			slug: `e2e-country-role-${randomUUID()}`,
		});

		return { name, documentId: person.documentId };
	}

	test("records a national coordinator and the committee membership over one period", async ({
		db,
		page,
	}) => {
		const person = await createPerson(db, "NC");

		await fillAppointment(page, {
			personName: person.name,
			countryName,
			role: "national coordinator",
		});

		await submitAndWait(
			page,
			"Save",
			"The appointment and its committee membership have been saved.",
		);

		const relations = await db.getPersonRelations(person.documentId);
		expect(relations).toHaveLength(2);

		const role = relations.find((relation) => relation.roleType === "national_coordinator");
		const seat = relations.find((relation) => relation.roleType === "is_member_of");

		expect(role?.unitDocumentId).toBe(countryDocumentId);
		expect(seat?.unitSlug).toBe("national-coordinator-committee");

		// The mismatch the paired rule exists to catch: both rows must carry the same period.
		expect(seat?.start).toStrictEqual(role?.start);
		expect(role?.end).toBeNull();
		expect(seat?.end).toBeNull();
	});

	/** A different rule, a different body — the mapping is the thing worth proving here. */
	test("records a national representative against the General Assembly", async ({ db, page }) => {
		const person = await createPerson(db, "NR");

		await fillAppointment(page, {
			personName: person.name,
			countryName,
			role: "national representative",
		});

		await submitAndWait(
			page,
			"Save",
			"The appointment and its committee membership have been saved.",
		);

		const relations = await db.getPersonRelations(person.documentId);
		const seat = relations.find((relation) => relation.roleType === "is_member_of");

		expect(relations).toHaveLength(2);
		expect(seat?.unitSlug).toBe("general-assembly");
	});

	/**
	 * The General Assembly rule accepts membership alone, so the wizard must not offer a choice there
	 * — while the committee rule accepts chair and vice-chair too.
	 */
	test("offers a governance-body role only where the rule accepts more than one", async ({
		db,
		page,
	}) => {
		const person = await createPerson(db, "Roles");

		await page.goto(BASE_PATH);
		await selectAsyncOption(page, "No person selected", person.name);
		await page.getByRole("button", { name: "Continue" }).click();
		await selectAsyncOption(page, "No country selected", countryName);

		await page.getByRole("button", { name: "Role" }).click();
		await page.getByRole("option", { name: "national representative", exact: true }).click();
		await expect(page.getByRole("button", { name: "Role on the governance body" })).toBeHidden();

		await page.getByRole("button", { name: "Role", exact: false }).first().click();
		await page.getByRole("option", { name: "national coordinator", exact: true }).click();
		await expect(page.getByRole("button", { name: "Role on the governance body" })).toBeVisible();
	});

	test("records the chosen chairship instead of plain membership", async ({ db, page }) => {
		const person = await createPerson(db, "Chair");

		await fillAppointment(page, {
			personName: person.name,
			countryName,
			role: "national coordinator",
			counterpartRole: "is chair of",
		});

		await submitAndWait(
			page,
			"Save",
			"The appointment and its committee membership have been saved.",
		);

		const relations = await db.getPersonRelations(person.documentId);
		const seat = relations.find(
			(relation) => relation.unitSlug === "national-coordinator-committee",
		);

		expect(seat?.roleType).toBe("is_chair_of");
	});

	test("ends the appointment and its committee seat on the same date", async ({ db, page }) => {
		const person = await createPerson(db, "End");

		await fillAppointment(page, {
			personName: person.name,
			countryName,
			role: "national coordinator",
		});
		await submitAndWait(
			page,
			"Save",
			"The appointment and its committee membership have been saved.",
		);

		// Now end it through the wizard's other mode.
		await page.goto(BASE_PATH);
		await page.getByRole("radio", { name: "End an appointment" }).click();
		await selectAsyncOption(page, "No person selected", person.name);
		await page.getByRole("button", { name: "Continue" }).click();

		await fillDatePicker(page, "End date", 2026, 6, 30);
		await page.getByRole("button", { name: "Review" }).click();

		await submitAndWait(
			page,
			"End both relations",
			"The appointment and its governance-body membership have been ended.",
		);

		const expectedEnd = new Date(Date.UTC(2026, 5, 30, 0, 0, 0, 0));
		const relations = await db.getPersonRelations(person.documentId);

		expect(relations).toHaveLength(2);
		for (const relation of relations) {
			expect(relation.end).toStrictEqual(expectedEnd);
		}
	});
});
