import { expect, test } from "@/e2e/lib/test";

test.describe("country reports admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 *
	 * Each suite creates a dedicated open campaign via DB so that the create-report preCheck passes.
	 * Campaign and reports are cleaned up in afterAll.
	 */
	test.describe.configure({ mode: "default" });

	function campaignYearForTest(offset: number): number {
		return 3200 + test.info().workerIndex * 10 + offset;
	}

	test("should create a country report", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = campaignYearForTest(0);
		const reportsPage = createAdminCountryReportsPage(workerIndex);
		// oxlint-disable-next-line no-useless-assignment
		let reportId: string | null = null;

		const campaign = await db.createOpenCampaign(campaignYear);

		const country = await db.getCountryOption();

		try {
			await reportsPage.gotoCreate();
			await reportsPage.selectCampaignByYear(campaignYear);
			await reportsPage.selectFirstCountry();
			await reportsPage.selectStatus("submitted");
			await reportsPage.submitForm();

			const created = await db.getCountryReportByCampaignAndCountry(campaign.id, country.id);
			expect(created).not.toBeNull();
			expect(created).toMatchObject({ status: "submitted" });
			reportId = created!.id;
		} finally {
			// oxlint-disable-next-line playwright/no-conditional-in-test
			if (reportId != null) {
				await db.deleteCountryReport(reportId);
			}
			await db.deleteReportingCampaign(campaign.id);
		}
	});

	test("should edit country report status", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = campaignYearForTest(1);
		const reportsPage = createAdminCountryReportsPage(workerIndex);
		const campaign = await db.createOpenCampaign(campaignYear);
		const country = await db.getCountryOption();
		const report = await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
			status: "submitted",
		});

		try {
			await reportsPage.gotoEdit(report.id);
			await reportsPage.selectStatus("accepted");
			await reportsPage.submitForm();

			const updated = await db.getCountryReportById(report.id);
			expect(updated).not.toBeNull();
			expect(updated).toMatchObject({ status: "accepted" });
		} finally {
			await db.deleteCountryReport(report.id);
			await db.deleteReportingCampaign(campaign.id);
		}
	});

	test("should delete a country report", async ({ createAdminCountryReportsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = campaignYearForTest(2);
		const reportsPage = createAdminCountryReportsPage(workerIndex);
		const campaign = await db.createOpenCampaign(campaignYear);
		const country = await db.getCountryOption();
		// oxlint-disable-next-line no-useless-assignment
		let reportId: string | null = null;

		try {
			await reportsPage.gotoCreate();
			await reportsPage.selectCampaignByYear(campaignYear);
			await reportsPage.selectFirstCountry();
			await reportsPage.selectStatus("submitted");
			await reportsPage.submitForm();

			const report = await db.getCountryReportByCampaignAndCountry(campaign.id, country.id);
			expect(report).not.toBeNull();
			reportId = report!.id;

			await reportsPage.goto();

			// scope by the test's unique campaign year — the country name alone is not unique against real data.
			const deleteDialog = await reportsPage.openDeleteDialog(country.name, campaignYear);
			await expect(deleteDialog).toBeVisible();
			await reportsPage.confirmDelete(deleteDialog);

			const deleted = await db.getCountryReportById(reportId);
			expect(deleted).toBeNull();
			reportId = null;
		} finally {
			// oxlint-disable-next-line playwright/no-conditional-in-test
			if (reportId != null) {
				await db.deleteCountryReport(reportId);
			}
			await db.deleteReportingCampaign(campaign.id);
		}
	});
});
