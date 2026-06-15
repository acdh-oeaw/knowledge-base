import type { Locator, Page } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/country-reports";

export class AdminCountryReportsPage {
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

	async gotoEdit(id: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${id}/edit`);
	}

	// ---------------------------------------------------------------------------
	// Form helpers
	// ---------------------------------------------------------------------------

	async selectCampaignByYear(year: number): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Campaign", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: String(year) }).click();
	}

	async selectFirstCountry(): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Country", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option").first().click();
	}

	async selectStatus(status: string): Promise<void> {
		const label = status.charAt(0).toUpperCase() + status.slice(1);
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Status", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async submitForm(): Promise<void> {
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: BASE_PATH,
			trigger: async () => {
				await this.page.getByRole("button", { name: "Save" }).click();
			},
		});
	}

	// ---------------------------------------------------------------------------
	// List page helpers
	// ---------------------------------------------------------------------------

	async searchByText(text: string): Promise<void> {
		await fillSearchAndWaitForUrl(this.page, BASE_PATH, text);
	}

	rowByCountry(name: string, campaignYear?: number): Locator {
		const row = this.page.getByRole("row").filter({ hasText: name });
		// the country name is not unique against real data; narrow by the test's unique campaign year.
		return campaignYear == null ? row : row.filter({ hasText: String(campaignYear) });
	}

	async openDeleteDialog(countryName: string, campaignYear?: number): Promise<Locator> {
		const row = this.rowByCountry(countryName, campaignYear);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete country report/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}
}
