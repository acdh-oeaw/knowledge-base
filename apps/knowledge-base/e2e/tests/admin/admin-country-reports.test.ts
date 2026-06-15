import { expect, test } from "@/e2e/lib/test";

test.describe("country reports admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 *
	 * Each suite creates a dedicated open campaign (year = 3200 + workerIndex) via DB so that the
	 * create-report preCheck passes. Campaign and reports are cleaned up in afterAll.
	 */
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let countryId: string | null = null;
	let reportId: string | null = null;

	test.afterAll(async ({ db }) => {
		if (reportId != null) {
			await db.deleteCountryReport(reportId);
		}
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("should create a country report", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = 3200 + workerIndex;
		const reportsPage = createAdminCountryReportsPage(workerIndex);

		const campaign = await db.createOpenCampaign(campaignYear);
		campaignId = campaign.id;

		const country = await db.getCountryOption();
		countryId = country.id;

		await reportsPage.gotoCreate();
		await reportsPage.selectCampaignByYear(campaignYear);
		await reportsPage.selectFirstCountry();
		await reportsPage.selectStatus("submitted");
		await reportsPage.submitForm();

		const created = await db.getCountryReportByCampaignAndCountry(campaignId, countryId);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ status: "submitted" });
		reportId = created!.id;
	});

	test("should edit country report status", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const reportsPage = createAdminCountryReportsPage(workerIndex);

		await reportsPage.gotoEdit(reportId!);
		await reportsPage.selectStatus("accepted");
		await reportsPage.submitForm();

		const updated = await db.getCountryReportById(reportId!);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({ status: "accepted" });
	});

	test("should delete a country report", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = 3200 + workerIndex;
		const reportsPage = createAdminCountryReportsPage(workerIndex);

		await reportsPage.goto();

		// scope by the test's unique campaign year — the country name alone is not unique against real data.
		const deleteDialog = await reportsPage.openDeleteDialog(
			(await db.getCountryOption()).name,
			campaignYear,
		);
		await expect(deleteDialog).toBeVisible();
		await reportsPage.confirmDelete(deleteDialog);

		const deleted = await db.getCountryReportById(reportId!);
		expect(deleted).toBeNull();
		reportId = null;
	});
});
