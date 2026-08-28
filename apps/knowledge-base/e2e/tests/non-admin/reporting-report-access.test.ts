import { expect, test } from "@/e2e/lib/test";

/**
 * A plain authenticated user (the `non-admin` storage state) has no national-coordinator / chair /
 * member relation, so `can(read/update, <report>)` is false. Opening a report editor therefore
 * resolves to `forbidden` in the layout's authorization helper and renders the 404 page — the user
 * cannot reach reports they are not associated with.
 *
 * Both report types are seeded under one campaign and cleaned up afterwards.
 */
test.describe("non-associated user report access", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let year: number | null = null;
	let countrySlug: string | null = null;
	let workingGroupSlug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3600 + test.info().workerIndex;
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

	test("cannot open an unrelated country report", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${countrySlug!}/edit/events`);

		await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
		await expect(page.getByText("Error 404")).toBeVisible();
		await expect(page.getByLabel("Small events")).toBeHidden();
	});

	test("cannot open an unrelated working group report", async ({ page }) => {
		await page.goto(
			`/en/dashboard/reporting/working-group-reports/${year!}/${workingGroupSlug!}/edit/data`,
		);

		await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
		await expect(page.getByText("Error 404")).toBeVisible();
		await expect(page.getByLabel("Number of members")).toBeHidden();
	});
});
