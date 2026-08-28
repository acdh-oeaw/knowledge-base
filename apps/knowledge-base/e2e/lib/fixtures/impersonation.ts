import { type Locator, type Page, expect } from "@playwright/test";

/**
 * The identity behind the `impersonation` project: seeded in `global-setup`, used by
 * `playwright.config.ts` to resolve its storage state, and named here so the suite can assert its
 * own actor labels in the audit log.
 *
 * It is a second admin rather than the shared `admin` persona because impersonation is stored on
 * the impersonator's _session_ row: every test sharing that session is impersonated with it,
 * including the suites running concurrently in the other Playwright worker, which would find the
 * whole `/administrator` tree answering 403 mid-test.
 */
export const impersonationAdmin = {
	email: "e2e-impersonation-admin@example.com",
	name: "E2E Impersonation Admin",
	storageFile: "admin-impersonation.json",
} as const;

/**
 * Shared helpers for driving an impersonated session. The banner is the only control that appears
 * on every dashboard page while impersonating, so it doubles as the assertion target for "am I
 * still acting as someone else" and as the way back.
 */
export class ImpersonationBanner {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	get locator(): Locator {
		return this.page.getByRole("status").filter({ hasText: "You are signed in as" });
	}

	async expectVisibleFor(name: string): Promise<void> {
		await expect(this.locator).toBeVisible();
		await expect(this.locator).toContainText(name);
	}

	async expectHidden(): Promise<void> {
		await expect(this.locator).toBeHidden();
	}

	async returnToOwnAccount(): Promise<void> {
		await this.locator.getByRole("button", { name: "Return to my account" }).click();
		await this.page.waitForURL("**/dashboard");
		await this.expectHidden();
	}

	/**
	 * The notice shown when the impersonated user has not finished onboarding and therefore could not
	 * reach these screens themselves.
	 */
	get onboardingNotice(): Locator {
		return this.locator.getByText("they cannot sign in themselves yet", { exact: false });
	}
}

/** The refusal every credential-mutating action returns while impersonating. */
export const impersonationRefusalMessage = "Not available while signed in as another user.";

export class AuthSettingsPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	async goto(): Promise<void> {
		await this.page.goto("/en/auth/settings");
		await this.page.waitForURL("**/auth/settings");
	}

	sectionForm(heading: string): Locator {
		return this.page.locator("section").filter({ hasText: heading }).locator("form");
	}

	async submitUpdateEmail(email: string): Promise<Locator> {
		const form = this.sectionForm("Update email");
		await form.getByLabel("New email").fill(email);
		await form.getByRole("button", { name: "Update" }).click();
		return form;
	}

	async submitUpdatePassword(current: string, next: string): Promise<Locator> {
		const form = this.sectionForm("Update password");
		await form.getByLabel("Current password").fill(current);
		await form.getByLabel("New password", { exact: true }).fill(next);
		await form.getByLabel("Confirm new password").fill(next);
		await form.getByRole("button", { name: "Update" }).click();
		return form;
	}

	async submitRegenerateRecoveryCode(): Promise<Locator> {
		const form = this.sectionForm("Recovery code");
		await form.getByRole("button", { name: "Generate new code" }).click();
		return form;
	}
}

/** Signs out via the dashboard user menu. */
export async function signOutFromUserMenu(page: Page): Promise<void> {
	await page.getByRole("button", { name: "Open menu" }).click();
	await page.getByRole("menuitem", { name: "Sign out" }).click();
}
