import { expect, test } from "@/e2e/lib/test";

/**
 * Guards the report editor's unsaved-changes warning (`ReportEditGuard`). Each editor screen is its
 * own route, so leaving a screen with unsaved input must prompt — both for a client-side tab switch
 * (intercepted at the react-aria `RouterProvider` `navigate`) and for a hard exit / reload
 * (`beforeunload`).
 *
 * A draft country report is seeded directly via the DB (keyed by the worker's own campaign year)
 * and cleaned up afterwards.
 */
test.describe("report editor unsaved-changes guard", () => {
	test.describe.configure({ mode: "default" });

	const BASE_PATH = "/en/dashboard/administrator/country-reports";

	let campaignId: string | null = null;
	let reportId: string | null = null;

	test.beforeAll(async ({ db }) => {
		const campaignYear = 3400 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(campaignYear);
		campaignId = campaign.id;

		const country = await db.getCountryOption();
		const report = await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
			status: "draft",
		});
		reportId = report.id;
	});

	test.afterAll(async ({ db }) => {
		if (reportId != null) {
			await db.deleteCountryReport(reportId);
		}
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("warns before a client-side tab switch when there are unsaved changes", async ({ page }) => {
		await page.goto(`${BASE_PATH}/${reportId!}/edit/events`);

		// Dirty the form (fires an `input` event the guard listens for).
		await page.getByLabel("Small events").fill("7");

		// Dismiss the confirm → the navigation is cancelled. The handler resolves the dialog
		// synchronously so the page's blocked `confirm()` returns and the click action settles.
		let firstDialog: { message: string; type: string } | null = null;
		page.once("dialog", async (dialog) => {
			firstDialog = { message: dialog.message(), type: dialog.type() };
			await dialog.dismiss();
		});
		await page.getByRole("tab", { name: "Institutions" }).click();

		expect(firstDialog).not.toBeNull();
		expect(firstDialog!.type).toBe("confirm");
		expect(firstDialog!.message).toMatch(/unsaved changes/i);

		// Navigation was cancelled: still on the events screen with the in-progress value intact.
		await expect(page).toHaveURL(new RegExp(`${reportId!}/edit/events`));
		await expect(page.getByRole("tab", { name: "Events" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await expect(page.getByLabel("Small events")).toHaveValue("7");

		// Accepting the confirm lets the same navigation proceed.
		page.once("dialog", async (dialog) => {
			await dialog.accept();
		});
		await page.getByRole("tab", { name: "Institutions" }).click();
		await expect(page).toHaveURL(new RegExp(`${reportId!}/edit/institutions`));
	});

	test("warns on a hard exit (reload) when there are unsaved changes", async ({ page }) => {
		await page.goto(`${BASE_PATH}/${reportId!}/edit/events`);

		await page.getByLabel("Small events").fill("9");

		let beforeUnloadFired = false;
		page.on("dialog", async (dialog) => {
			if (dialog.type() === "beforeunload") {
				beforeUnloadFired = true;
			}
			// Accept so the reload proceeds and the action settles.
			await dialog.accept();
		});
		await page.reload();

		expect(beforeUnloadFired).toBe(true);
	});
});
