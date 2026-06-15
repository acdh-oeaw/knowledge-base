import { randomUUID } from "node:crypto";

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "@/e2e/lib/test";

/**
 * Regression guards for the entity edit form tabs.
 *
 * The edit form switches tabs client-side via the native History API and keeps every panel mounted
 * (inactive ones hidden with CSS). Two invariants matter, one per test:
 *
 * 1. Interactivity — if tabs are ever switched via a router navigation again (e.g. a `<Link>`), the
 *    navigated-to panel re-renders and its react-aria controls (e.g. a `Select`) are not wired up:
 *    clicking the trigger only focuses it, `aria-expanded` stays "false", and no options appear.
 *    The History API keeps tab switching client-side, so the controls stay interactive.
 * 2. State preservation — the panels stay mounted (hidden via CSS) so in-progress form state survives
 *    a tab switch. If a panel were unmounted instead, its (uncontrolled) values would be lost.
 */
function roleSelectTrigger(page: Page): Locator {
	return page
		.locator('[data-slot="control"]')
		.filter({ has: page.getByText("Role", { exact: true }) })
		.locator("button");
}

test.describe("edit form tab switching", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerGovernanceBodies(testInfo.workerIndex);
	});

	test("keeps react-aria selects interactive after switching tabs", async ({
		page,
		createAdminGovernanceBodiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);
		const name = `${governanceBodiesPage.workerPrefix} Tab Interactivity ${randomUUID()}`;

		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for tab interactivity test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.gotoEditFromList(name);

		// Round-trip the tabs, then open the Role select fresh. If tabs switch via a router navigation,
		// the re-rendered People panel's Select is not interactive: the click is a no-op and the listbox
		// never opens. Wait for each switch to settle (the `?tab=` reflects in the URL) so a router
		// navigation actually completes and re-renders before the next step — with the History API this
		// is instant.
		await governanceBodiesPage.goToPeopleTab();
		await expect(page).toHaveURL(/[?&]tab=people/);
		await governanceBodiesPage.goToRelationsTab();
		await expect(page).toHaveURL(/[?&]tab=relations/);
		await governanceBodiesPage.goToPeopleTab();
		await expect(page).toHaveURL(/[?&]tab=people/);

		const roleTrigger = roleSelectTrigger(page);
		await roleTrigger.click();
		await expect(roleTrigger).toHaveAttribute("aria-expanded", "true");
		await expect(page.getByRole("option").first()).toBeVisible();
	});

	test("preserves in-progress form state across tab switches", async ({
		page,
		createAdminGovernanceBodiesPage,
	}) => {
		const workerIndex = test.info().workerIndex;
		const governanceBodiesPage = createAdminGovernanceBodiesPage(workerIndex);
		const name = `${governanceBodiesPage.workerPrefix} Tab State ${randomUUID()}`;

		await governanceBodiesPage.gotoCreate();
		await governanceBodiesPage.fillName(name);
		await governanceBodiesPage.fillDescription("Description for tab state test.");
		await governanceBodiesPage.submitForm();

		await governanceBodiesPage.gotoEditFromList(name);

		// Type into an uncontrolled text field (the acronym is a `defaultValue` input — its value lives
		// only in the DOM) on the Details tab. The form is NOT saved; this is purely in-progress state.
		const acronymValue = "E2EKEEP";
		await governanceBodiesPage.goToDetailsTab();
		await governanceBodiesPage.fillAcronym(acronymValue);

		// Pick a value in a react-aria Select on the People tab.
		await governanceBodiesPage.goToPeopleTab();
		await governanceBodiesPage.selectFirstPersonRole();
		const roleTrigger = roleSelectTrigger(page);
		await expect(roleTrigger).not.toContainText("Select an item");
		const selectedRole = ((await roleTrigger.textContent()) ?? "").trim();
		expect(selectedRole).not.toBe("");

		// Switch away and back — the panels stay mounted (hidden via CSS), so neither value is lost.
		await governanceBodiesPage.goToRelationsTab();
		await governanceBodiesPage.goToPeopleTab();

		// The react-aria Select kept its selected value across the round trip.
		await expect(roleTrigger).toContainText(selectedRole);

		// The uncontrolled text field on the Details tab kept its in-progress value (it would be lost if
		// the panel were unmounted instead of hidden).
		await governanceBodiesPage.goToDetailsTab();
		await expect(page.getByLabel("Acronym")).toHaveValue(acronymValue);
	});
});
