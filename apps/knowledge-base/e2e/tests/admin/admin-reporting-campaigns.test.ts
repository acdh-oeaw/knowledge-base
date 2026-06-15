import { expect, test } from "@/e2e/lib/test";

test.describe("reporting campaigns admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 *
	 * Campaign year = 3100 + workerIndex ensures no year conflicts between workers. The campaign is
	 * deleted as the final test; afterAll is a safety-net for failures mid-suite.
	 */
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("should create a reporting campaign", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = 3100 + workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		await campaignsPage.gotoCreate();
		await campaignsPage.fillYear(campaignYear);
		await campaignsPage.selectStatus("open");
		await campaignsPage.submitCreateForm();

		const created = await db.getReportingCampaignByYear(campaignYear);
		expect(created).not.toBeNull();
		expect(created).toMatchObject({ year: campaignYear, status: "open" });
		campaignId = created!.id;

		await campaignsPage.searchByYear(campaignYear);
		await expect(campaignsPage.rowByYear(campaignYear)).toBeVisible();
	});

	test("should update campaign settings", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);
		const updatedYear = 3100 + workerIndex;

		await campaignsPage.gotoSettings(campaignId!);
		await campaignsPage.fillYear(updatedYear);
		await campaignsPage.selectStatus("closed");
		await campaignsPage.submitCreateForm();

		const updated = await db.getReportingCampaignById(campaignId!);
		expect(updated).not.toBeNull();
		expect(updated).toMatchObject({ year: updatedYear, status: "closed" });

		// Restore to "open" so country/WG report tests (if they share the DB year) still work.
		// This test suite owns 3100+workerIndex so we restore here inline.
		await campaignsPage.gotoSettings(campaignId!);
		await campaignsPage.selectStatus("open");
		await campaignsPage.submitCreateForm();
	});

	test("should set event amounts", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		await campaignsPage.gotoEvents(campaignId!);
		await campaignsPage.fillByLabel("Small events", "10");
		await campaignsPage.fillByLabel("Medium events", "20");
		await campaignsPage.fillByLabel("Large events", "30");
		await campaignsPage.fillByLabel("Very large events", "40");
		await campaignsPage.fillByLabel("DARIAH commissioned event", "50");
		await campaignsPage.saveTabForm();

		const amounts = await db.getCampaignEventAmounts(campaignId!);
		const byType = Object.fromEntries(amounts.map((a) => [a.eventType, a.amount]));
		expect(byType).toMatchObject({
			small: 10,
			medium: 20,
			large: 30,
			very_large: 40,
			dariah_commissioned: 50,
		});
	});

	test("should set contribution amounts", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		await campaignsPage.gotoContributions(campaignId!);
		await campaignsPage.fillByLabel("National coordinator", "100");
		await campaignsPage.fillByLabel("National coordinator deputy", "50");
		await campaignsPage.saveTabForm();

		const amounts = await db.getCampaignContributionAmounts(campaignId!);
		const byRole = Object.fromEntries(amounts.map((a) => [a.roleType, a.amount]));
		expect(byRole).toMatchObject({
			national_coordinator: 100,
			national_coordinator_deputy: 50,
		});
	});

	test("should set service sizes", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		await campaignsPage.gotoServices(campaignId!);
		await campaignsPage.fillByLabel("Small — visits threshold", "1000");
		await campaignsPage.fillByLabel("Small — amount", "10");
		await campaignsPage.fillByLabel("Medium — visits threshold", "5000");
		await campaignsPage.fillByLabel("Medium — amount", "20");
		await campaignsPage.fillByLabel("Large — visits threshold", "10000");
		await campaignsPage.fillByLabel("Large — amount", "30");
		await campaignsPage.fillByLabel("Very large — visits threshold", "50000");
		await campaignsPage.fillByLabel("Very large — amount", "40");
		await campaignsPage.fillByLabel("Core service amount", "5");
		await campaignsPage.saveTabForm();

		const sizes = await db.getCampaignServiceSizes(campaignId!);
		const bySize = Object.fromEntries(
			sizes.map((s) => [s.serviceSize, { amount: s.amount, threshold: s.visitsThreshold }]),
		);
		expect(bySize).toMatchObject({
			small: { threshold: 1000, amount: 10 },
			medium: { threshold: 5000, amount: 20 },
			large: { threshold: 10000, amount: 30 },
			very_large: { threshold: 50000, amount: 40 },
			core: { amount: 5 },
		});
	});

	test("should set social media amounts", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		await campaignsPage.gotoSocialMedia(campaignId!);
		await campaignsPage.fillByLabel("Website", "200");
		await campaignsPage.fillByLabel("Other", "100");
		await campaignsPage.saveTabForm();

		const amounts = await db.getCampaignSocialMediaAmounts(campaignId!);
		const byCategory = Object.fromEntries(amounts.map((a) => [a.category, a.amount]));
		expect(byCategory).toMatchObject({ website: 200, other: 100 });
	});

	test("should delete a reporting campaign", async ({ createAdminReportingCampaignsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const campaignYear = 3100 + workerIndex;
		const campaignsPage = createAdminReportingCampaignsPage(workerIndex);

		// Previous tab-form tests wrote rows to FK-constrained sub-tables. Clean
		// them up so the app's simple DELETE action can succeed.
		await db.cleanupCampaignSubTables(campaignId!);

		await campaignsPage.goto();
		await campaignsPage.searchByYear(campaignYear);
		await expect(campaignsPage.rowByYear(campaignYear)).toBeVisible();

		const deleteDialog = await campaignsPage.openDeleteDialog(campaignYear);
		await expect(deleteDialog).toBeVisible();
		await campaignsPage.confirmDelete(deleteDialog);

		await expect(campaignsPage.rowByYear(campaignYear)).toBeHidden();

		const deleted = await db.getReportingCampaignById(campaignId!);
		expect(deleted).toBeNull();
		campaignId = null;
	});
});
