import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/users";

export class AdminUsersPage {
	readonly page: Page;
	readonly workerIndex: number;

	constructor(page: Page, workerIndex: number) {
		this.page = page;
		this.workerIndex = workerIndex;
	}

	get workerPrefix(): string {
		return `[e2e-worker-${String(this.workerIndex)}]`;
	}

	async goto(): Promise<void> {
		await this.page.goto(BASE_PATH);
		await this.page.waitForURL(`**${BASE_PATH}`);
	}

	async gotoCreate(): Promise<void> {
		await this.page.goto(`${BASE_PATH}/create`);
	}

	// ---------------------------------------------------------------------------
	// Form helpers
	// ---------------------------------------------------------------------------

	async fillName(name: string): Promise<void> {
		await this.page.getByLabel("Name", { exact: true }).fill(name);
	}

	async fillEmail(email: string): Promise<void> {
		await this.page.getByLabel("Email").fill(email);
	}

	async fillPassword(password: string): Promise<void> {
		await this.page.getByLabel("Password").fill(password);
	}

	async selectRole(role: "Admin" | "User"): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Role", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: role, exact: true }).click();
	}

	async setCanManageAdmins(): Promise<void> {
		const checkbox = this.page.getByRole("checkbox", { name: "Can manage other admin users" });
		if (!(await checkbox.isChecked())) {
			await checkbox.focus();
			await this.page.keyboard.press("Space");
			await expect(checkbox).toBeChecked();
		}
	}

	async selectActorType(actorType: "Person" | "Country" | "None"): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Link to", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: actorType, exact: true }).click();
	}

	async selectActor(label: "Person" | "Country", name: string): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator('[data-slot="label"]', { hasText: label }) });

		// Trigger has aria-label="ui" (i18n build bug); target by aria-expanded instead.
		await control.locator("button[aria-expanded]:not([slot])").click();
		await this.page.getByRole("searchbox").fill(name);
		await this.page.keyboard.press("Enter");
		const option = this.page.getByRole("option", { name, exact: true });
		await expect(option).toBeVisible();
		await option.click();
		await expect(control.getByText(name, { exact: true })).toBeVisible();
	}

	async selectPersonActor(name: string): Promise<void> {
		await this.selectActorType("Person");
		await this.selectActor("Person", name);
	}

	async selectCountryActor(name: string): Promise<void> {
		await this.selectActorType("Country");
		await this.selectActor("Country", name);
	}

	async submitForm(): Promise<void> {
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: BASE_PATH,
			trigger: async () => {
				await this.page.getByRole("button", { name: /^Save(?! and publish\b).*$/ }).click();
			},
		});
	}

	// ---------------------------------------------------------------------------
	// List page helpers
	// ---------------------------------------------------------------------------

	async searchByName(name: string): Promise<void> {
		await fillSearchAndWaitForUrl(this.page, BASE_PATH, name);
	}

	rowByName(name: string): Locator {
		return this.page.getByRole("row").filter({ hasText: name });
	}

	async openDeleteDialog(name: string): Promise<Locator> {
		const row = this.rowByName(name);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete user/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
	}
}
