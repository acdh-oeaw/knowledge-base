import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/internal-services";

export class AdminServicesPage {
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

	async selectFirstType(): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Type", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option").first().click();
	}

	async selectFirstStatus(): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Status", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option").first().click();
	}

	async fillComment(comment: string): Promise<void> {
		await this.page.locator('textarea[name="comment"]').fill(comment);
	}

	async selectOrganisationalUnit(
		label: "Service owners" | "Service providers",
		name: string,
	): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator('[data-slot="label"]', { hasText: label }) });

		// The control renders several buttons; the "Add" DialogTrigger is the one carrying
		// `aria-expanded`.
		await control.locator("button[aria-expanded]:not([slot])").click();
		await this.page.getByRole("searchbox").fill(name);
		await this.page.keyboard.press("Enter");

		const option = this.page.getByRole("option", { name, exact: true });
		await expect(option).toBeVisible();
		await option.click();
		await expect(control.getByText(name, { exact: true })).toBeVisible();
		// The options popover stays open after picking an item. Dismiss it with Escape, which the
		// component handles explicitly (see AsyncListSelect's onKeyDownCapture); clicking the trigger
		// is unreliable because the popover's modal overlay intercepts the pointer event.
		await this.page.keyboard.press("Escape");
		await expect(this.page.getByRole("listbox", { name: label })).toBeHidden();
	}

	async selectServiceOwner(name: string): Promise<void> {
		await this.selectOrganisationalUnit("Service owners", name);
	}

	async selectServiceProvider(name: string): Promise<void> {
		await this.selectOrganisationalUnit("Service providers", name);
	}

	async setFlag(name: "dariahBranding" | "monitoring" | "privateSupplier"): Promise<void> {
		const labelByName = {
			dariahBranding: "DARIAH branding",
			monitoring: "Monitoring",
			privateSupplier: "Private supplier",
		} as const;
		const checkbox = this.page.getByRole("checkbox", { name: labelByName[name] });
		if (!(await checkbox.isChecked())) {
			await checkbox.focus();
			await this.page.keyboard.press("Space");
			await expect(checkbox).toBeChecked();
		}
	}

	async unsetFlag(name: "dariahBranding" | "monitoring" | "privateSupplier"): Promise<void> {
		const labelByName = {
			dariahBranding: "DARIAH branding",
			monitoring: "Monitoring",
			privateSupplier: "Private supplier",
		} as const;
		const checkbox = this.page.getByRole("checkbox", { name: labelByName[name] });
		if (await checkbox.isChecked()) {
			await checkbox.focus();
			await this.page.keyboard.press("Space");
			await expect(checkbox).not.toBeChecked();
		}
	}

	async removeSelectedOrganisationalUnits(
		label: "Service owners" | "Service providers",
	): Promise<void> {
		// Selected items render as rows in a grid list (aria-label === the control label); each row has
		// a single Remove button, which sits outside the popover trigger, so removing does not open the
		// popover.
		const list = this.page.getByRole("grid", { name: label });
		const removeButtons = list.getByRole("row").getByRole("button");
		while ((await removeButtons.count()) > 0) {
			await removeButtons.first().click();
		}
	}

	async submitForm(): Promise<void> {
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: new RegExp(`^${BASE_PATH}/[^/]+/details$`),
			trigger: async () => {
				await this.page.getByRole("button", { name: /^Save(?! and publish\b).*$/ }).click();
			},
		});
		await this.goto();
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
		return this.page.getByRole("dialog", { name: /Delete service/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
	}
}
