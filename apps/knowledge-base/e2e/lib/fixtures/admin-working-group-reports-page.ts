import type { Locator, Page } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { firstSeededOption } from "@/e2e/lib/fixtures/options";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/working-group-reports";

export class AdminWorkingGroupReportsPage {
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

	async selectFirstWorkingGroup(): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Working group", { exact: true }) });
		await control.locator("button").click();
		await firstSeededOption(this.page).click();
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

	rowByWorkingGroup(name: string): Locator {
		return this.page.getByRole("row").filter({ hasText: name });
	}

	/**
	 * The reports list shows the working-group name, so a name-only filter collides with the seed's
	 * own "<group> 2025" report (and any other worker's report for the same group). Scope by the
	 * worker-unique campaign year to target exactly this worker's row.
	 */
	async openDeleteDialog(workingGroupName: string, campaignYear: number): Promise<Locator> {
		const row = this.rowByWorkingGroup(workingGroupName).filter({ hasText: String(campaignYear) });
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete working group report/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}
}
