import { expect, test } from "@/e2e/lib/test";

/**
 * Country-report lifecycle as a national coordinator (the `nc` persona — see
 * `seedReportingPersonas` in global-setup). Pins the server-side state machine hardened in
 * `permissions.ts` + `submit-country-report.action.ts`:
 *
 * - A national coordinator may submit a `draft` report while the campaign is `open` (draft ->
 *   submitted);
 * - Once submitted there is no re-submit (the Submit button is gone);
 * - Editing is frozen after submit — a content mutation redirects to `/dashboard` (the
 *   `assertReportEditable` guard) and persists nothing.
 *
 * Test data is isolated by the worker's own campaign year and cleaned up afterwards.
 */
test.describe("country report lifecycle (national coordinator)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let reportId: string | null = null;
	let year: number | null = null;
	let slug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3500 + test.info().workerIndex;
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

	test("a coordinator submits a draft report", async ({ page, db }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${slug!}/edit/summary`);

		// The draft is submittable by the coordinator.
		const submitButton = page.getByRole("button", { name: "Submit report" });
		await expect(submitButton).toBeVisible();

		await submitButton.click();

		// After the action redirects back to the summary screen the report is submitted and there is no
		// re-submit affordance.
		await expect(page.getByRole("button", { name: "Submit report" })).toBeHidden();
		await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

		const updated = await db.getCountryReportById(reportId!);
		expect(updated).toMatchObject({ status: "submitted" });
	});

	test("editing is frozen once the report is submitted", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${slug!}/edit/events`);

		// The screen still renders (the coordinator retains the `update` permission), but saving is
		// blocked: the content mutation's `assertReportEditable` guard redirects to the dashboard. A
		// successful save would instead stay on the events screen, so the redirect is the signal that
		// the edit was rejected and nothing was persisted.
		await page.getByLabel("Small events").fill("7");
		// Scope to the events form: the screen also renders a comment section with its own "Save".
		await page
			.locator("form")
			.filter({ has: page.getByLabel("Small events") })
			.getByRole("button", { name: "Save" })
			.click();

		await expect(page).toHaveURL(/\/en\/dashboard$/);
	});
});
