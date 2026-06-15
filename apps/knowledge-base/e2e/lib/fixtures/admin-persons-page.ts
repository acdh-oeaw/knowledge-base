import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/persons";

export class AdminPersonsPage {
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

	async fillSortName(sortName: string): Promise<void> {
		await this.page.getByLabel("Sort name").fill(sortName);
	}

	async fillEmail(email: string): Promise<void> {
		await this.page.locator('input[name="email"]').fill(email);
	}

	async fillOrcid(orcid: string): Promise<void> {
		await this.page.locator('input[name="orcid"]').fill(orcid);
	}

	async fillBiography(text: string): Promise<void> {
		const editor = this.page.getByRole("textbox", { name: "Biography" });
		await editor.click();
		await this.page.keyboard.type(text);
	}

	async insertImageInBiography(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: "Insert image" }).click();
		await this.page.waitForSelector('[role="dialog"]');
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
		await expect(this.page.getByLabel("Image block", { exact: true })).toBeVisible();
	}

	async typeBiographyAfterImage(text: string): Promise<void> {
		const editor = this.page.getByRole("textbox", { name: "Biography" });
		await editor.press("ArrowRight");
		await this.page.keyboard.type(text);
	}

	async selectImageFromMediaLibrary(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: "Select image" }).click();
		await this.page.waitForSelector('[role="dialog"]');
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
	}

	async removeImage(): Promise<void> {
		await this.page.getByRole("button", { name: "Remove image" }).click();
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
		return this.page.getByRole("dialog", { name: /Delete person/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
	}

	async gotoEditFromList(name: string): Promise<void> {
		await this.searchByName(name);
		const row = this.rowByName(name);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			this.page.waitForURL("**/edit"),
			this.page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
	}

	// ---------------------------------------------------------------------------
	// Edit page — contributions section
	// ---------------------------------------------------------------------------

	async goToContributionsTab(): Promise<void> {
		await this.page.getByRole("tab", { name: "Contributions" }).click();
	}

	contributionsTable(): Locator {
		return this.page.getByRole("grid", { name: "contributions" });
	}

	async selectFirstContributionRole(): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Role", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option").first().click();
	}

	async selectFirstContributionOrg(): Promise<void> {
		await this.page.getByRole("button", { name: "Select an organisation" }).click();
		await this.page.getByRole("option").first().waitFor({ state: "visible" });
		await this.page.getByRole("option").first().click();
	}

	async fillContributionDatePicker(
		label: string,
		year: number,
		month: number,
		day: number,
	): Promise<void> {
		const group = this.page.getByRole("group", { name: label });
		await group.getByRole("spinbutton", { name: /day/i }).click();
		await this.page.keyboard.type(String(day).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /month/i }).click();
		await this.page.keyboard.type(String(month).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /year/i }).click();
		await this.page.keyboard.type(String(year));
	}

	async submitAddContribution(): Promise<void> {
		await waitForActionSuccess({
			page: this.page,
			trigger: async () => {
				await this.page.getByRole("button", { name: "Add contribution" }).click();
			},
		});
	}

	async openFirstContributionsRowAction(action: string): Promise<void> {
		await this.contributionsTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await this.page.getByRole("menuitem", { name: action }).click();
	}

	async clickEndContribution(): Promise<void> {
		await this.openFirstContributionsRowAction("End contribution");
	}

	async fillEndContributionDate(year: number, month: number, day: number): Promise<void> {
		const dialog = this.page.getByRole("alertdialog", { name: "End contribution" });
		await dialog.waitFor({ state: "visible" });
		const group = dialog.getByRole("group", { name: "End date" });
		await group.getByRole("spinbutton", { name: /day/i }).click();
		await this.page.keyboard.type(String(day).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /month/i }).click();
		await this.page.keyboard.type(String(month).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /year/i }).click();
		await this.page.keyboard.type(String(year));
	}

	async confirmEndContribution(): Promise<void> {
		const dialog = this.page.getByRole("alertdialog", { name: "End contribution" });
		await dialog.getByRole("button", { name: "Confirm" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async clickEditContribution(): Promise<void> {
		await this.openFirstContributionsRowAction("Edit contribution");
		await this.page
			.getByRole("dialog", { name: "Edit contribution" })
			.waitFor({ state: "visible" });
	}

	async fillEditContributionDate(
		label: string,
		year: number,
		month: number,
		day: number,
	): Promise<void> {
		const dialog = this.page.getByRole("dialog", { name: "Edit contribution" });
		const group = dialog.getByRole("group", { name: label });
		await group.getByRole("spinbutton", { name: /day/i }).click();
		await this.page.keyboard.type(String(day).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /month/i }).click();
		await this.page.keyboard.type(String(month).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /year/i }).click();
		await this.page.keyboard.type(String(year));
	}

	async saveEditContribution(): Promise<void> {
		const dialog = this.page.getByRole("dialog", { name: "Edit contribution" });
		await dialog.getByRole("button", { name: "Save" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async clickDeleteContribution(): Promise<void> {
		await this.openFirstContributionsRowAction("Delete contribution");
		await this.page
			.getByRole("alertdialog", { name: "Delete contribution" })
			.waitFor({ state: "visible" });
	}

	async confirmDeleteContribution(): Promise<void> {
		const dialog = this.page.getByRole("alertdialog", { name: "Delete contribution" });
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	// ---------------------------------------------------------------------------
	// Details page — navigation
	// ---------------------------------------------------------------------------

	async gotoDetailsFromList(name: string): Promise<void> {
		const row = this.rowByName(name);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "View" }).click();
		await this.page.waitForURL(`**${BASE_PATH}/**/details`);
	}

	async gotoEditFromDetails(): Promise<void> {
		const editHref = await this.page.getByRole("link", { name: "Edit" }).getAttribute("href");

		if (editHref == null) {
			throw new Error("Could not find edit link on person details page.");
		}

		await this.page.goto(editHref);
		await this.page.waitForURL(`**${BASE_PATH}/**/edit`);
	}

	// ---------------------------------------------------------------------------
	// Details page — status badges
	// ---------------------------------------------------------------------------

	/** "Draft" badge in the lifecycle bar (only present when no published version exists). */
	detailsDraftBadge(): Locator {
		return this.page.getByText("Draft", { exact: true });
	}

	/** "Published" badge in the lifecycle bar (only present when published-only, no draft). */
	detailsPublishedBadge(): Locator {
		return this.page.getByText("Published", { exact: true });
	}

	/** "Published with draft changes" badge in the lifecycle bar (draft + published both exist). */
	detailsPublishedWithDraftChangesBadge(): Locator {
		return this.page.getByText("Published with draft changes");
	}

	// ---------------------------------------------------------------------------
	// Details page — lifecycle actions
	// ---------------------------------------------------------------------------

	async publishItem(): Promise<void> {
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: BASE_PATH,
			trigger: async () => {
				await this.page.getByRole("button", { name: "Publish" }).click();
			},
		});
	}

	async discardDraft(): Promise<void> {
		await this.page.getByRole("button", { name: "Discard draft" }).click();
		const dialog = this.page.getByRole("dialog");
		await dialog.waitFor({ state: "visible" });
		await waitForActionRedirect({
			page: this.page,
			redirectPathname: BASE_PATH,
			trigger: async () => {
				await dialog.getByRole("button", { name: "Discard" }).click();
			},
		});
	}

	// ---------------------------------------------------------------------------
	// Details page — version selector
	// ---------------------------------------------------------------------------

	versionSelectorDraftLink(): Locator {
		return this.page.getByRole("link", { name: "Draft" });
	}

	versionSelectorPublishedLink(): Locator {
		return this.page.getByRole("link", { name: "Published" });
	}

	// ---------------------------------------------------------------------------
	// List page — status badge within a row
	// ---------------------------------------------------------------------------

	/** "Published" status badge inside a specific list row. */
	publishedBadgeInRow(name: string): Locator {
		return this.rowByName(name).getByText("Published", { exact: true });
	}

	/** "Draft" status badge inside a specific list row. */
	draftBadgeInRow(name: string): Locator {
		return this.rowByName(name).getByText("Draft", { exact: true });
	}
}
