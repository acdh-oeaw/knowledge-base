import { randomUUID } from "node:crypto";

import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import {
	AuthSettingsPage,
	ImpersonationBanner,
	impersonationAdmin,
	impersonationRefusalMessage,
	signOutFromUserMenu,
} from "@/e2e/lib/fixtures/impersonation";
import { expect, test } from "@/e2e/lib/test";

/**
 * End-to-end shape of impersonation. The unit suite (`test/auth/impersonation.test.ts`) pins the
 * auth service's guards; this pins what an admin actually experiences: the effective user changes,
 * admin-only routes close behind them, credential-mutating actions refuse outright, and there is
 * always a way back.
 *
 * Runs under the `impersonation` project -- its own admin, and the reason the project exists: an
 * impersonation lives on the session row, so sharing the `admin` session would turn every admin
 * test running concurrently in the other worker non-admin for as long as it lasted. It impersonates
 * the seeded `nc` persona -- the same national coordinator the `nc` suite signs in as -- so "an
 * admin sees what the coordinator sees" is asserted against a persona whose own view is covered
 * elsewhere.
 */
test.describe("impersonation", () => {
	test.describe.configure({ mode: "default" });

	const ncName = "E2E National Coordinator";
	const ncEmail = "e2e-nc@example.com";
	const adminName = impersonationAdmin.name;
	const adminEmail = impersonationAdmin.email;

	/** The audit log renders actors as `name (email)` -- see `resolveActorLabels`. */
	const ncActorLabel = `${ncName} (${ncEmail})`;
	const adminActorLabel = `${adminName} (${adminEmail})`;

	/**
	 * This suite's own session is shared across its tests, so an impersonation surviving a failed
	 * assertion would hand every later test here a non-admin identity.
	 */
	test.afterEach(async ({ db }) => {
		await db.clearImpersonationsForUser(adminEmail);
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerUsers(testInfo.workerIndex);
	});

	test("should act as the impersonated user and offer a way back", async ({
		createAdminUsersPage,
		page,
	}) => {
		const usersPage = createAdminUsersPage(test.info().workerIndex);
		const banner = new ImpersonationBanner(page);

		await usersPage.goto();
		await usersPage.searchByName(ncName);
		await usersPage.startImpersonation(ncName);

		await banner.expectVisibleFor(ncName);

		/**
		 * The effective user drives authorisation, so the admin tree closes behind them. The
		 * `/administrator` layout answers with `forbidden()`, which renders 403 in place rather than
		 * redirecting -- so the URL is unchanged and the page content is what to assert on.
		 */
		await page.goto("/en/dashboard/administrator/users");
		await expect(page.getByText("Error 403")).toBeVisible();

		await page.goto("/en/dashboard");
		await banner.returnToOwnAccount();

		// ...and admin access comes back with them.
		await usersPage.goto();
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
	});

	test("should refuse to impersonate another admin", async ({ createAdminUsersPage }) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);

		const name = `${usersPage.workerPrefix} Admin ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+${randomUUID()}@example.com`;

		await usersPage.gotoCreate();
		await usersPage.fillName(name);
		await usersPage.fillEmail(email);
		await usersPage.fillPassword("TestPassword123!");
		await usersPage.selectRole("Admin");
		await usersPage.submitForm();

		await usersPage.searchByName(name);
		const action = await usersPage.openImpersonationRowAction(name);

		await expect(action).toBeDisabled();
	});

	/**
	 * Impersonation carries the admin's own completed sign-in, so an un-onboarded user can be acted
	 * as even though they could not reach the dashboard themselves. The banner has to say so, or an
	 * admin helping with "I can't get past this screen" would see a working dashboard and conclude
	 * the problem had gone away. A freshly created user is exactly that case: unverified, no TOTP.
	 */
	test("warns when the impersonated user has not finished onboarding", async ({
		createAdminUsersPage,
		page,
	}) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);
		const banner = new ImpersonationBanner(page);

		const name = `${usersPage.workerPrefix} Unonboarded ${randomUUID()}`;
		const email = `e2e-worker-${String(workerIndex)}+${randomUUID()}@example.com`;

		await usersPage.gotoCreate();
		await usersPage.fillName(name);
		await usersPage.fillEmail(email);
		await usersPage.fillPassword("TestPassword123!");
		await usersPage.submitForm();

		await usersPage.searchByName(name);
		await usersPage.startImpersonation(name);

		await banner.expectVisibleFor(name);
		await expect(banner.onboardingNotice).toBeVisible();
		await expect(banner.onboardingNotice).toContainText(
			"have not verified their email or set up two-factor authentication",
		);

		await banner.returnToOwnAccount();
	});

	test("does not warn when the impersonated user is fully onboarded", async ({
		createAdminUsersPage,
		page,
	}) => {
		const usersPage = createAdminUsersPage(test.info().workerIndex);
		const banner = new ImpersonationBanner(page);

		await usersPage.goto();
		await usersPage.searchByName(ncName);
		await usersPage.startImpersonation(ncName);

		await banner.expectVisibleFor(ncName);
		await expect(banner.onboardingNotice).toBeHidden();

		await banner.returnToOwnAccount();
	});

	/**
	 * The sharpest failure mode: while impersonating, the credential behind the session is still the
	 * admin's, so an unguarded settings action would change the wrong account's password, email or
	 * recovery code. Each must refuse rather than silently pick one of the two accounts.
	 */
	test.describe("credential-mutating actions are blocked", () => {
		test.beforeEach(async ({ createAdminUsersPage, page }) => {
			const usersPage = createAdminUsersPage(test.info().workerIndex);
			await usersPage.goto();
			await usersPage.searchByName(ncName);
			await usersPage.startImpersonation(ncName);
			await new ImpersonationBanner(page).expectVisibleFor(ncName);
		});

		test("refuses an email change", async ({ page }) => {
			const settings = new AuthSettingsPage(page);
			await settings.goto();

			const form = await settings.submitUpdateEmail(`e2e-blocked-${randomUUID()}@example.com`);

			await expect(form.getByText(impersonationRefusalMessage)).toBeVisible();
		});

		test("refuses a password change", async ({ page }) => {
			const settings = new AuthSettingsPage(page);
			await settings.goto();

			const form = await settings.submitUpdatePassword("TestPassword123!", "NewPassword456!");

			await expect(form.getByText(impersonationRefusalMessage)).toBeVisible();
		});

		test("refuses regenerating the recovery code", async ({ page }) => {
			const settings = new AuthSettingsPage(page);
			await settings.goto();

			const form = await settings.submitRegenerateRecoveryCode();

			await expect(form.getByText(impersonationRefusalMessage)).toBeVisible();
		});

		/**
		 * The settings page reads the _authenticated_ account, not the effective one -- otherwise an
		 * admin would be looking at the coordinator's email while editing their own.
		 */
		test("shows the admin's own account, not the impersonated one", async ({ page }) => {
			const settings = new AuthSettingsPage(page);
			await settings.goto();

			await expect(page.getByText(adminEmail)).toBeVisible();
			await expect(page.getByText(ncEmail)).toBeHidden();
		});
	});

	test("signing out while impersonating returns to the admin's own account", async ({
		createAdminUsersPage,
		page,
	}) => {
		const usersPage = createAdminUsersPage(test.info().workerIndex);
		const banner = new ImpersonationBanner(page);

		await usersPage.goto();
		await usersPage.searchByName(ncName);
		await usersPage.startImpersonation(ncName);
		await banner.expectVisibleFor(ncName);

		await signOutFromUserMenu(page);

		// Back on the dashboard as the admin -- not signed out to the public site.
		await page.waitForURL("**/dashboard");
		await banner.expectHidden();
		await usersPage.goto();
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
	});

	test("a lapsed impersonation returns to the admin's account without signing them out", async ({
		createAdminUsersPage,
		db,
		page,
	}) => {
		const usersPage = createAdminUsersPage(test.info().workerIndex);
		const banner = new ImpersonationBanner(page);

		await usersPage.goto();
		await usersPage.searchByName(ncName);
		await usersPage.startImpersonation(ncName);
		await banner.expectVisibleFor(ncName);

		await db.expireImpersonationsForUser(adminEmail);

		await page.goto("/en/dashboard");

		// Still signed in: being silently signed out mid-form is worse than being un-impersonated.
		await banner.expectHidden();
		await usersPage.goto();
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
	});

	/**
	 * The reason impersonation is acceptable at all: an edit made while acting as someone else stays
	 * attributed to their account, with the admin recorded alongside it.
	 */
	test("records impersonated edits against both accounts in the audit log", async ({
		createAdminUsersPage,
		db,
		page,
	}) => {
		const workerIndex = test.info().workerIndex;
		const usersPage = createAdminUsersPage(workerIndex);
		const banner = new ImpersonationBanner(page);

		const year = 3570 + workerIndex;
		const campaign = await db.createOpenCampaign(year);
		const country = await db.getCountryOption();
		await db.createCountryReport({
			campaignId: campaign.id,
			countryDocumentId: country.id,
			status: "draft",
		});

		try {
			await usersPage.goto();
			await usersPage.searchByName(ncName);
			await usersPage.startImpersonation(ncName);
			await banner.expectVisibleFor(ncName);

			// The actual use case: an admin filling in a coordinator's report for them.
			await page.goto(
				`/en/dashboard/reporting/country-reports/${String(year)}/${country.slug}/edit/events`,
			);
			await page.getByLabel("Small events").fill("3");
			await waitForActionSuccess({
				page,
				trigger: async () => {
					await page
						.locator("form")
						.filter({ has: page.getByLabel("Small events") })
						.getByRole("button", { name: "Save" })
						.click();
				},
			});

			await page.goto("/en/dashboard");
			await banner.returnToOwnAccount();

			await page.goto("/en/dashboard/administrator/internal");

			/**
			 * The edit is attributed to the coordinator's account -- what they expect to see in their own
			 * history -- with the admin named alongside it rather than in place of it.
			 */
			const editRow = page
				.getByRole("row")
				.filter({ has: page.getByRole("gridcell", { name: "update", exact: true }) })
				.filter({
					has: page.getByRole("gridcell", {
						name: `${ncActorLabel} (via ${adminActorLabel})`,
						exact: true,
					}),
				});
			await expect(editRow.first()).toBeVisible();

			// Starting the impersonation is the admin's own act, so it is attributed to them alone.
			const startRow = page
				.getByRole("row")
				.filter({ has: page.getByRole("gridcell", { name: "impersonation start", exact: true }) })
				.filter({ has: page.getByRole("gridcell", { name: adminActorLabel, exact: true }) });
			await expect(startRow.first()).toBeVisible();
		} finally {
			await db.deleteReportingCampaign(campaign.id);
		}
	});
});
