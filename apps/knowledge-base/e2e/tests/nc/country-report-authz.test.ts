import { expect, test } from "@/e2e/lib/test";

/**
 * Authorization boundaries for the `nc` persona (national coordinator of the first published
 * country). Pins `can(country_report, ...)` in `permissions.ts`: an active `national_coordinator`
 * relation grants access to _that_ country's report only, and a non-admin user is still locked out
 * of the `/administrator` tree.
 *
 * Two reports are seeded under one campaign — one for the coordinator's own country, one for
 * another country — so the relation-scoping is exercised against real authz paths.
 */
test.describe("country report authorization (national coordinator)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let year: number | null = null;
	let ownSlug: string | null = null;
	let ownCountryName: string | null = null;
	let otherSlug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3610 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const ownCountry = await db.getCountryOption();
		ownSlug = ownCountry.slug;
		ownCountryName = ownCountry.name;
		await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: ownCountry.id,
			status: "draft",
		});

		const otherCountry = await db.getOtherCountryOption();
		otherSlug = otherCountry.slug;
		await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: otherCountry.id,
			status: "draft",
		});
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("can open its own country's report editor", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${ownSlug!}/edit/events`);

		await expect(page.getByRole("heading", { name: ownCountryName! })).toBeVisible();
		await expect(page.getByLabel("Small events")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Page not found" })).toBeHidden();
	});

	test("is not found for another country's report", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/country-reports/${year!}/${otherSlug!}/edit/events`);

		// The report exists, but the coordinator has no relation to that country, so the editor's
		// authorization helper returns `forbidden` and `notFound()` renders the branded 404 page.
		await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
		await expect(page.getByLabel("Small events")).toBeHidden();
	});

	test("is forbidden from the administrator tree", async ({ page }) => {
		await page.goto("/en/dashboard/administrator/country-reports");

		await expect(page.getByText("Error 403")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Access forbidden" })).toBeVisible();
	});
});
