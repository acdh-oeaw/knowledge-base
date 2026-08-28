import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { expect, test } from "@/e2e/lib/test";

/**
 * The guided forms exist to stop a partner institution being recorded without the country it is
 * located in — the omission `unitRelationRequirementRules` otherwise only reports after the fact.
 * These tests therefore assert the outcome those rules care about: all the rows written together,
 * and the country-membership warning raised before anything is saved.
 */

const BASE_PATH = "/en/dashboard/administrator/guided-forms";

function workerPrefix(): string {
	return `[e2e-worker-${String(test.info().workerIndex)}]`;
}

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

/**
 * `AsyncSelect`'s trigger is named after its placeholder, not its label, so it is addressed the
 * same way the relation-section tests already do.
 */
async function selectAsyncOption(
	page: Page,
	triggerName: string,
	searchText: string,
): Promise<void> {
	await page.getByRole("button", { name: triggerName }).click();

	const searchInput = page.getByRole("dialog", { name: triggerName }).getByRole("searchbox");
	await searchInput.fill(searchText);
	await searchInput.press("Enter");

	const option = page.getByRole("option").first();
	await option.waitFor({ state: "visible" });
	await option.click();
}

/**
 * Runs the partner-institution wizard up to, but not including, its submit. Pass `existing: true`
 * to pick an institution that is already in the database rather than describing a new one.
 */
async function fillPartnerInstitutionWizard(
	page: Page,
	params: { name: string; countryName: string; status: string; existing?: boolean },
): Promise<void> {
	await page.goto(`${BASE_PATH}/partner-institution`);

	// Step 1 — a new institution described by its core fields, or one that already exists.
	if (params.existing === true) {
		await page.getByRole("radio", { name: "Select an existing institution" }).click();
		await selectAsyncOption(page, "No institution selected", params.name);
	} else {
		await page.getByRole("radio", { name: "Create a new institution" }).click();
		await page.getByLabel("Name", { exact: true }).fill(params.name);
	}
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 2 — the country. This is the relation the wizard exists to make unmissable.
	await selectAsyncOption(page, "No country selected", params.countryName);
	await fillDatePicker(page, "Located there from", 2026, 1, 1);
	await page.getByRole("button", { name: "Continue" }).click();

	// Step 3 — the status towards DARIAH-EU. A `Select` trigger's accessible name is its label plus
	// the current value, so it is matched loosely, as the relation-section tests do.
	await page.getByRole("button", { name: "Status" }).click();
	await page.getByRole("option", { name: params.status, exact: true }).click();
	await fillDatePicker(page, "From", 2026, 1, 1);
	await page.getByRole("button", { name: "Review" }).click();
}

test.describe("guided forms", () => {
	/** Run sequentially within this file; test data is isolated by Playwright worker index. */
	test.describe.configure({ mode: "default" });

	/**
	 * A country that is a member of DARIAH-EU, which these tests need because
	 * `countryMembershipRules` judges a partner institution against its country's membership.
	 *
	 * The seed does not provide one — its fixtures hang off a separate `kitchen-sink-eric` unit,
	 * while every rule is pinned to the `dariah-eu` slug — so the membership is established here and
	 * removed again afterwards.
	 */
	let memberCountry: { documentId: string; name: string };
	let seededMembershipId: string | null = null;

	test.beforeAll(async ({ db }) => {
		const existing = await db.getCountryByDariahMembership(true);

		if (existing != null) {
			memberCountry = existing;
			return;
		}

		const candidate = await db.getFirstPublishedCountry();
		if (candidate == null) {
			throw new Error("No published country to run the guided-form tests against.");
		}

		seededMembershipId = await db.ensureDariahEricMembership(candidate.documentId);
		memberCountry = candidate;
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerInstitutions(testInfo.workerIndex);

		if (seededMembershipId != null) {
			await db.deleteUnitRelationById(seededMembershipId);
		}
	});

	test("lists the available guided forms", async ({ page }) => {
		await page.goto(BASE_PATH);

		await expect(page.getByRole("heading", { name: "Guided forms" })).toBeVisible();
		await expect(page.getByText("Record an institution's status towards DARIAH-EU")).toBeVisible();
		await expect(
			page.getByText("Start or end a national coordinator or representative appointment"),
		).toBeVisible();
		await expect(page.getByText("End a working group or a country's membership")).toBeVisible();
	});

	test("creates an institution together with its country and DARIAH-EU status", async ({
		db,
		page,
	}) => {
		const name = `${workerPrefix()} Wizard Institution ${randomUUID()}`;

		await fillPartnerInstitutionWizard(page, {
			name,
			countryName: memberCountry.name,
			status: "is partner institution of",
		});

		// The review step states every row before anything is written. Matched exactly: the wizard's
		// own description mentions these relations in prose too.
		await expect(page.getByText("Will create").first()).toBeVisible();
		await expect(page.getByText("is located in", { exact: true })).toBeVisible();
		await expect(page.getByText("is partner institution of", { exact: true })).toBeVisible();

		// Creating a new institution offers both draft and publish; the draft button is the one that
		// leaves the institution for an editor to finish, which is what the wizard is for.
		await waitForActionSuccess({
			page,
			trigger: async () => {
				await page.getByRole("button", { name: "Save (as draft)" }).click();
			},
		});

		await expect(
			page.getByText("The partner institution and its relations have been saved."),
		).toBeVisible();

		const institution = await db.getInstitutionByName(name);
		expect(institution).not.toBeNull();

		const relations = await db.getUnitRelationsBySourceDocumentId(institution!.documentId);
		expect(relations.map((relation) => relation.statusType).toSorted()).toStrictEqual([
			"is_located_in",
			"is_partner_institution_of",
		]);

		// The relation that is normally forgotten must point at the country that was picked.
		const locatedIn = relations.find((relation) => relation.statusType === "is_located_in");
		expect(locatedIn?.relatedUnitDocumentId).toBe(memberCountry.documentId);
	});

	/**
	 * Exercises `dariah-cooperating-partner-in-non-member-country` rather than its sibling: a
	 * cooperating partner belongs in a country that is _not_ a member, so choosing that status for a
	 * member country trips the rule. Written this way round because it needs only the member country
	 * the suite already establishes.
	 */
	test("warns before saving when the status contradicts the country's membership", async ({
		db,
		page,
	}) => {
		const name = `${workerPrefix()} Wizard Warning ${randomUUID()}`;

		await fillPartnerInstitutionWizard(page, {
			name,
			countryName: memberCountry.name,
			status: "is cooperating partner of",
		});

		await expect(page.getByText("is a member or observer of DARIAH-EU")).toBeVisible();

		// The warning is advisory, not a block — but nothing is written while it is on screen.
		expect(await db.getInstitutionByName(name)).toBeNull();
	});

	/**
	 * Publishing is a separate branch of the submit — it clones the draft into a published version
	 * and fans out to the search index and the members-partners webhook. Only the draft path is
	 * covered above, so the institution would otherwise never be published by a test.
	 */
	test("publishes the institution when asked to save and publish", async ({ db, page }) => {
		const name = `${workerPrefix()} Wizard Published ${randomUUID()}`;

		await fillPartnerInstitutionWizard(page, {
			name,
			countryName: memberCountry.name,
			status: "is partner institution of",
		});

		await page.getByRole("button", { name: "Save and publish institution" }).click();
		await expect(
			page.getByText("The partner institution and its relations have been saved."),
		).toBeVisible();

		const institution = await db.getInstitutionByName(name);
		expect(institution).not.toBeNull();
		expect(await db.getPublishedVersionId(institution!.documentId)).not.toBeNull();
	});

	/**
	 * The review step promises "Already recorded" for a relation that exists; the submit must then
	 * leave it alone. Inserting it again would hit the duration-overlap exclusion constraint, so a
	 * regression here surfaces as a failed save rather than a duplicate — either way the wizard would
	 * stop being safe to re-run.
	 */
	test("does not duplicate a country relation the institution already has", async ({
		db,
		page,
	}) => {
		const name = `${workerPrefix()} Wizard Existing ${randomUUID()}`;

		const institution = await db.createPublishedInstitution({
			name,
			slug: `e2e-wizard-existing-${randomUUID()}`,
		});
		await db.addUnitRelation({
			unitDocumentId: institution.documentId,
			relatedUnitDocumentId: memberCountry.documentId,
			statusType: "is_located_in",
			start: new Date("2020-01-01T00:00:00.000Z"),
		});

		await fillPartnerInstitutionWizard(page, {
			name,
			countryName: memberCountry.name,
			status: "is partner institution of",
			existing: true,
		});

		await expect(page.getByText("Already recorded")).toBeVisible();

		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(
			page.getByText("The partner institution and its relations have been saved."),
		).toBeVisible();

		const relations = await db.getUnitRelationsBySourceDocumentId(institution.documentId);
		const locatedIn = relations.filter((relation) => relation.statusType === "is_located_in");

		expect(locatedIn).toHaveLength(1);
		expect(relations.map((relation) => relation.statusType).toSorted()).toStrictEqual([
			"is_located_in",
			"is_partner_institution_of",
		]);
	});
});
