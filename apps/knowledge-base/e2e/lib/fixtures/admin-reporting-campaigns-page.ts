import type { Locator, Page } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/reporting-campaigns";

export class AdminReportingCampaignsPage {
	readonly page: Page;
	readonly workerIndex: number;

	constructor(page: Page, workerIndex: number) {
		this.page = page;
		this.workerIndex = workerIndex;
	}

	get workerPrefix(): string {
		return `[e2e-worker-${String(this.workerIndex)}]`;
	}

	// ---------------------------------------------------------------------------
	// Navigation
	// ---------------------------------------------------------------------------

	async goto(): Promise<void> {
		await this.page.goto(BASE_PATH);
		await this.page.waitForURL(`**${BASE_PATH}`);
	}

	async gotoCreate(): Promise<void> {
		await this.page.goto(`${BASE_PATH}/create`);
	}

	async gotoSettings(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/settings`);
	}

	async gotoEvents(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/events`);
	}

	async gotoContributions(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/contributions`);
	}

	async gotoServices(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/services`);
	}

	async gotoSocialMedia(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/social-media`);
	}

	async gotoCountries(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit/countries`);
	}

	// ---------------------------------------------------------------------------
	// Create / settings form helpers
	// ---------------------------------------------------------------------------

	async fillYear(year: number): Promise<void> {
		const input = this.page.getByLabel("Year", { exact: true });
		await input.clear();
		await input.fill(String(year));
	}

	async selectStatus(status: string): Promise<void> {
		const label = status.charAt(0).toUpperCase() + status.slice(1);
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Status", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async submitCreateForm(): Promise<void> {
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: BASE_PATH,
			trigger: async () => {
				await this.page.getByRole("button", { name: "Save" }).click();
			},
		});
	}

	// ---------------------------------------------------------------------------
	// Tab form helpers — no redirect on save
	// ---------------------------------------------------------------------------

	async fillByLabel(labelText: string, value: string): Promise<void> {
		await this.page.getByLabel(labelText, { exact: true }).fill(value);
	}

	async saveTabForm(): Promise<void> {
		await waitForActionSuccess({
			page: this.page,
			trigger: async () => {
				await this.page.getByRole("button", { name: "Save" }).click();
			},
		});
	}

	async fillCountryThreshold(countryId: string, value: string): Promise<void> {
		await this.page.locator(`input[name="amounts.${countryId}"]`).fill(value);
	}

	// ---------------------------------------------------------------------------
	// List page helpers
	// ---------------------------------------------------------------------------

	async searchByYear(year: number): Promise<void> {
		await fillSearchAndWaitForUrl(this.page, BASE_PATH, String(year));
	}

	rowByYear(year: number): Locator {
		return this.page.getByRole("row").filter({ hasText: String(year) });
	}

	async openDeleteDialog(year: number): Promise<Locator> {
		const row = this.rowByYear(year);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete reporting campaign/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}
}
