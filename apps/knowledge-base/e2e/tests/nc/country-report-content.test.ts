import type { Locator, Page } from "@playwright/test";

import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { expect, test } from "@/e2e/lib/test";

/**
 * Country-report content editing as a national coordinator. Covers the Events tab: a normal save
 * round-trip (values persist), and the server-side guard that rejects a purely numeric
 * `dariahCommissionedEvent` title (`update-country-report-events.schema.ts`).
 *
 * The report is a draft in an open campaign so editing is allowed; it is cleaned up afterwards.
 */

/** The events content form, scoped away from the screen's comment form (which has its own "Save"). */
function eventsForm(page: Page): Locator {
	return page.locator("form").filter({ has: page.getByLabel("Small events") });
}

test.describe("country report content (national coordinator)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let reportId: string | null = null;
	let year: number | null = null;
	let slug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3550 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const country = await db.getCountryOption();
		slug = country.slug;
		const report = await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
			status: "draft",
		});
		reportId = report.id;
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("saves event counts and persists them", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${slug!}/edit/events`);

		await page.getByLabel("Small events").fill("4");
		await page.getByLabel("Medium events").fill("2");
		// Scope to the events form: the screen also renders a comment section with its own "Save". Wait
		// for the (non-redirecting) save action to finish before reloading, otherwise the reload aborts
		// the in-flight POST and nothing is persisted.
		await waitForActionSuccess({
			page,
			trigger: async () => {
				await eventsForm(page).getByRole("button", { name: "Save" }).click();
			},
		});

		// Stays on the editor (a successful content save does not redirect) and the values survive a
		// reload — i.e. they were persisted to the report.
		await expect(page.getByLabel("Small events")).toHaveValue("4");

		await page.reload();
		await expect(page.getByLabel("Small events")).toHaveValue("4");
		await expect(page.getByLabel("Medium events")).toHaveValue("2");
	});

	test("rejects a numeric DARIAH-commissioned event title", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${slug!}/edit/events`);

		await page.getByLabel("Title").fill("123");
		await eventsForm(page).getByRole("button", { name: "Save" }).click();

		// The schema's `v.check` rejects a purely numeric title; the field error is shown and nothing
		// is persisted (the title field is empty again after a reload).
		await expect(page.getByText("Enter the event title, not a number.")).toBeVisible();

		await page.reload();
		await expect(page.getByLabel("Title")).toHaveValue("");
	});

	test("adds and removes a curated service membership", async ({ db, page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${slug!}/edit/services`);

		await page.getByRole("button", { name: "Service" }).click();
		const option = page.getByRole("option").first();
		const serviceName = await option.textContent();
		expect(serviceName).not.toBeNull();
		await option.click();
		await page.getByRole("button", { name: "Add", exact: true }).click();

		// Assert against the membership card, not the page: the picker keeps the selected service in its
		// combobox label (and a hidden native <option>), which would otherwise also match the name.
		const serviceCard = page.getByRole("listitem").filter({ hasText: serviceName! });
		await expect(serviceCard).toBeVisible();
		expect(await db.getCountryReportServiceIds(reportId!)).toHaveLength(1);

		await page.getByRole("button", { name: "Remove service" }).click();
		await expect(serviceCard).toHaveCount(0);
		expect(await db.getCountryReportServiceIds(reportId!)).toHaveLength(0);
	});
});
