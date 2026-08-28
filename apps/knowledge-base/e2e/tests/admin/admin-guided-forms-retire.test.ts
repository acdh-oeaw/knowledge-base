import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

/**
 * Retiring a unit is the one guided form that only ever _updates_ rows, and it decides which ones
 * from checkboxes on the review step. That selection is posted as dot-indexed array fields, so a
 * silent serialisation change would end fewer relations than the review promised — hence end-to-end
 * runs that check the dates actually landed, and that an unchecked row is genuinely left alone.
 *
 * Each test creates its own working group: retiring one ends every relation attached to it, and the
 * seeded working groups have chair relations the wgchair suite needs left open.
 */

const BASE_PATH = "/en/dashboard/administrator/guided-forms/retire-unit";

const END_DATE = { year: 2026, month: 6, day: 30 } as const;
const expectedEnd = new Date(Date.UTC(END_DATE.year, END_DATE.month - 1, END_DATE.day, 0, 0, 0, 0));

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

/** Drives the wizard as far as the review step for the given working group. */
async function openReviewFor(page: Page, workingGroupName: string): Promise<void> {
	await page.goto(BASE_PATH);

	// Working group is the default subtype, but select it explicitly so the test does not depend on
	// the order the rules happen to be declared in.
	await page.getByRole("button", { name: "Type" }).click();
	await page.getByRole("option", { name: "working group", exact: true }).click();

	await page.getByRole("button", { name: "No working group or country selected" }).click();
	const search = page
		.getByRole("dialog", { name: "No working group or country selected" })
		.getByRole("searchbox");
	await search.fill(workingGroupName);
	await search.press("Enter");
	const option = page.getByRole("option").first();
	await option.waitFor({ state: "visible" });
	await option.click();

	await fillDatePicker(page, "End date", END_DATE.year, END_DATE.month, END_DATE.day);
	await page.getByRole("button", { name: "Review" }).click();
}

test.describe("guided forms - retire a unit", () => {
	test.describe.configure({ mode: "default" });

	/** Person relations are not cleared by `deleteWorkingGroup`, so they are tracked and removed. */
	const personRelationIds: Array<string> = [];

	test.afterAll(async ({ db }, testInfo) => {
		for (const id of personRelationIds) {
			await db.deletePersonRelationById(id);
		}
		await db.cleanupWorkerWorkingGroups(testInfo.workerIndex);
		await db.cleanupWorkerPersons(testInfo.workerIndex);
	});

	interface Retirable {
		name: string;
		partOfRelationId: string;
		chairRelationId: string;
	}

	async function seedRetirableWorkingGroup(
		db: Parameters<Parameters<typeof test>[2]>[0]["db"],
		label: string,
	): Promise<Retirable> {
		const prefix = `[e2e-worker-${String(test.info().workerIndex)}]`;
		const name = `${prefix} Retire ${label} ${randomUUID()}`;

		const workingGroup = await db.createPublishedWorkingGroup({
			name,
			slug: `e2e-retire-wg-${randomUUID()}`,
		});

		// `inactive-working-group-relations-closed` triggers on an `is_part_of` relation; the rule does
		// not pin which unit it points at, so any published unit will do as the other end.
		const eric = await db.getEntityDocumentIdBySlug("dariah-eu");
		expect(eric, "the database must contain the dariah-eu unit").not.toBeNull();

		const partOfRelationId = await db.addUnitRelation({
			unitDocumentId: workingGroup.documentId,
			relatedUnitDocumentId: eric!,
			statusType: "is_part_of",
			start: new Date("2020-01-01T00:00:00.000Z"),
		});

		const personName = `${prefix} Retire Chair ${randomUUID()}`;
		const person = await db.createPublishedPerson({
			name: personName,
			sortName: personName,
			slug: `e2e-retire-person-${randomUUID()}`,
		});

		const chairRelationId = await db.addPersonRelation({
			personDocumentId: person.documentId,
			organisationalUnitDocumentId: workingGroup.documentId,
			roleType: "is_chair_of",
			start: new Date("2020-01-01T00:00:00.000Z"),
		});
		personRelationIds.push(chairRelationId);

		return { name, partOfRelationId, chairRelationId };
	}

	test("ends the unit's own relation and its dependent person relation on one date", async ({
		db,
		page,
	}) => {
		const unit = await seedRetirableWorkingGroup(db, "All");

		await openReviewFor(page, unit.name);

		// Both relations the rule names are listed, checked, and stated before anything is written.
		await expect(page.getByRole("checkbox", { name: /is part of/i })).toBeChecked();
		await expect(page.getByRole("checkbox", { name: /is chair of/i })).toBeChecked();
		await expect(page.getByText("Will update").first()).toBeVisible();

		expect(await db.getUnitRelationEndById(unit.partOfRelationId)).toBeNull();
		expect(await db.getPersonRelationEndById(unit.chairRelationId)).toBeNull();

		await page.getByRole("button", { name: "End the selected relations" }).click();
		await expect(page.getByText("relations have been ended")).toBeVisible();

		expect(await db.getUnitRelationEndById(unit.partOfRelationId)).toStrictEqual(expectedEnd);
		expect(await db.getPersonRelationEndById(unit.chairRelationId)).toStrictEqual(expectedEnd);
	});

	/**
	 * The checkboxes are the reason the review step exists: a relation that genuinely outlives the
	 * unit must survive the submit, and only what the admin confirmed may be written.
	 */
	test("leaves an unchecked relation open", async ({ db, page }) => {
		const unit = await seedRetirableWorkingGroup(db, "Partial");

		await openReviewFor(page, unit.name);

		// Toggled by keyboard: the checkbox's own indicator sits over its centre and swallows a
		// pointer click, and Space is how the control is operated anyway.
		const chairCheckbox = page.getByRole("checkbox", { name: /is chair of/i });
		await chairCheckbox.focus();
		await page.keyboard.press(" ");
		await expect(chairCheckbox).not.toBeChecked();

		await page.getByRole("button", { name: "End the selected relations" }).click();
		await expect(page.getByText("relations have been ended")).toBeVisible();

		expect(await db.getUnitRelationEndById(unit.partOfRelationId)).toStrictEqual(expectedEnd);
		expect(await db.getPersonRelationEndById(unit.chairRelationId)).toBeNull();
	});
});
