import { expect, test } from "@/e2e/lib/test";

/**
 * The `reporter` persona is a working-group _member_ and country _coordination staff_ — it may edit
 * report content but must not be able to submit (submitting is reserved for chairs / national
 * coordinators via `can(confirm, ...)`). This pins that the review screen offers no Submit button
 * to a reporter while the content editor still renders.
 */
test.describe("report submit gating (reporter)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let year: number | null = null;
	let countrySlug: string | null = null;
	let workingGroupSlug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3650 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const country = await db.getCountryOption();
		countrySlug = country.slug;
		await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
			status: "draft",
		});

		const workingGroup = await db.getWorkingGroupOption();
		workingGroupSlug = workingGroup.slug;
		await db.createWorkingGroupReport({
			campaignId: campaign.id,
			workingGroupDocumentId: workingGroup.id,
			status: "draft",
		});
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("country coordination staff can edit but cannot submit", async ({ page }) => {
		await page.goto(
			`/en/dashboard/reporting/country-reports/${year!}/${countrySlug!}/edit/summary`,
		);

		// The summary screen renders (read access) but offers no Submit affordance.
		await expect(page.getByText("Draft", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Submit report" })).toBeHidden();

		// Content editing is available.
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${countrySlug!}/edit/events`);
		await expect(page.getByLabel("Small events")).toBeVisible();
	});

	test("a working group member can edit but cannot submit", async ({ page }) => {
		await page.goto(
			`/en/dashboard/reporting/working-group-reports/${year!}/${workingGroupSlug!}/edit/summary`,
		);

		await expect(page.getByText("Draft", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Submit report" })).toBeHidden();

		await page.goto(
			`/en/dashboard/reporting/working-group-reports/${year!}/${workingGroupSlug!}/edit/data`,
		);
		await expect(page.getByLabel("Number of members")).toBeVisible();
	});
});
