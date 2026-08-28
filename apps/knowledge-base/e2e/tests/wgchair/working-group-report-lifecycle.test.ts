import { expect, test } from "@/e2e/lib/test";

/**
 * Working-group-report lifecycle as a chair (the `wgchair` persona — see `seedReportingPersonas`).
 * Mirrors the country-report lifecycle: a chair may submit a `draft` report in an `open` campaign
 * (draft -> submitted), there is no re-submit, and content editing is frozen afterwards
 * (`assertReportEditable` redirects to `/dashboard`).
 */
test.describe("working group report lifecycle (chair)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let reportId: string | null = null;
	let year: number | null = null;
	let slug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3700 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const workingGroup = await db.getWorkingGroupOption();
		slug = workingGroup.slug;
		const report = await db.createWorkingGroupReport({
			campaignId: campaign.id,
			workingGroupDocumentId: workingGroup.id,
			status: "draft",
		});
		reportId = report.id;
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("a chair submits a draft report", async ({ page, db }) => {
		await page.goto(`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/summary`);

		const submitButton = page.getByRole("button", { name: "Submit report" });
		await expect(submitButton).toBeVisible();

		await submitButton.click();

		await expect(page.getByRole("button", { name: "Submit report" })).toBeHidden();
		await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

		const updated = await db.getWorkingGroupReportById(reportId!);
		expect(updated).toMatchObject({ status: "submitted" });
	});

	test("editing is frozen once the report is submitted", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/data`);

		await page.getByLabel("Number of members").fill("12");
		// Scope to the data form: the screen also renders a comment section with its own "Save".
		await page
			.locator("form")
			.filter({ has: page.getByLabel("Number of members") })
			.getByRole("button", { name: "Save" })
			.click();

		await expect(page).toHaveURL(/\/en\/dashboard$/);
	});
});
