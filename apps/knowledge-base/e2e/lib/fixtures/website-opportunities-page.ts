import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { clearDateSegments } from "@/e2e/lib/fixtures/date-picker";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/website/opportunities";

export class WebsiteOpportunitiesPage {
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

	async fillTitle(title: string): Promise<void> {
		await this.page.getByLabel("Title").fill(title);
	}

	async fillSummary(summary: string): Promise<void> {
		await this.page.getByLabel("Summary").fill(summary);
	}

	async fillWebsite(website: string): Promise<void> {
		await this.page.locator('input[name="website"]').fill(website);
	}

	async selectFirstSource(): Promise<void> {
		const sourceControl = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Source", { exact: true }) });
		await sourceControl.locator("button").click();
		await this.page.getByRole("option").first().click();
	}

	async fillDatePicker(label: string, year: number, month: number, day: number): Promise<void> {
		const group = this.page.getByRole("group", { name: label });

		const daySegment = group.getByRole("spinbutton", { name: /day/i });
		const monthSegment = group.getByRole("spinbutton", { name: /month/i });
		const yearSegment = group.getByRole("spinbutton", { name: /year/i });

		await daySegment.click();
		await this.page.keyboard.type(String(day).padStart(2, "0"));

		await monthSegment.click();
		await this.page.keyboard.type(String(month).padStart(2, "0"));

		await yearSegment.click();
		await this.page.keyboard.type(String(year));
	}

	private contentBlockEditor(): Locator {
		return this.page.getByRole("textbox", { name: "Content" });
	}

	async addContentBlock(text: string): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.contentBlockEditor().fill(text);
	}

	async updateContentBlockText(text: string): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.clear();
		await editor.fill(text);
	}

	async clearDatePicker(label: string): Promise<void> {
		await clearDateSegments(this.page, label);
	}

	async removeFirstContentBlock(): Promise<void> {
		await this.page.getByRole("button", { name: "Remove block" }).first().click();
		const dialog = this.page.getByRole("alertdialog", { name: "Remove block" });
		await dialog.getByRole("button", { name: "Remove" }).click();
	}

	async selectImageFromMediaLibrary(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: /^(Select|Change) image$/ }).click();
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async uploadImageFromMediaLibrary(filePath: string, label: string): Promise<void> {
		await this.page.getByRole("button", { name: /^(Select|Change) image$/ }).click();
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		await dialog.getByRole("tab", { name: "Upload" }).click();
		await dialog.locator('input[type="file"]').setInputFiles(filePath);
		await dialog.getByLabel("Label").fill(label);
		await dialog.getByLabel("Alt text").fill(`${label} alt text`);
		await dialog.getByRole("button", { name: "Upload" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	private relatedEntitiesSection(): Locator {
		return this.page
			.locator("section")
			.filter({ has: this.page.getByRole("heading", { name: "Related entities", level: 2 }) });
	}

	private relatedResourcesSection(): Locator {
		return this.page
			.locator("section")
			.filter({ has: this.page.getByRole("heading", { name: "Related resources", level: 2 }) });
	}

	private relatedEntitiesDialog(): Locator {
		return this.page
			.getByRole("dialog")
			.filter({ has: this.page.getByRole("listbox", { name: "Related entities" }) });
	}

	private relatedResourcesDialog(): Locator {
		return this.page
			.getByRole("dialog")
			.filter({ has: this.page.getByRole("listbox", { name: "Related resources" }) });
	}

	private relatedEntitiesControl(): Locator {
		return this.relatedEntitiesSection().getByRole("button", { name: "Add related entity" });
	}

	private relatedResourcesControl(): Locator {
		return this.relatedResourcesSection().getByRole("button", { name: "Add related resource" });
	}

	private async closeRelatedEntitiesDialog(dialog: Locator): Promise<void> {
		await this.page.mouse.click(1, 1);
		await dialog.waitFor({ state: "hidden" });
	}

	private async closeRelatedResourcesDialog(dialog: Locator): Promise<void> {
		await this.page.mouse.click(1, 1);
		await dialog.waitFor({ state: "hidden" });
	}

	async selectRelatedEntity(entityName: string): Promise<void> {
		const trigger = this.relatedEntitiesControl();
		const dialog = this.relatedEntitiesDialog();

		await trigger.click();
		await dialog.waitFor({ state: "visible" });

		const searchbox = dialog.getByRole("searchbox");
		await searchbox.fill(entityName);

		const option = dialog.getByRole("option", { name: entityName, exact: true });
		await option.waitFor({ state: "visible" });
		await option.click();
		await this.closeRelatedEntitiesDialog(dialog);
	}

	async selectRelatedResource(resourceName: string): Promise<void> {
		const trigger = this.relatedResourcesControl();
		const dialog = this.relatedResourcesDialog();

		await trigger.click();
		await dialog.waitFor({ state: "visible" });

		const searchbox = dialog.getByRole("searchbox");
		await searchbox.fill(resourceName);

		const option = dialog.getByRole("option", { name: resourceName, exact: true });
		await option.waitFor({ state: "visible" });
		await option.click();
		await this.closeRelatedResourcesDialog(dialog);
	}

	async removeRelatedEntity(entityName: string): Promise<void> {
		const row = this.relatedEntitiesSection().getByRole("row", { name: entityName });
		await row.waitFor({ state: "visible" });
		await row.locator('button:not([slot="drag"])').click();
		await row.waitFor({ state: "hidden" });
	}

	async removeRelatedResource(resourceName: string): Promise<void> {
		const row = this.relatedResourcesSection().getByRole("row", { name: resourceName });
		await row.waitFor({ state: "visible" });
		await row.locator('button:not([slot="drag"])').click();
		await row.waitFor({ state: "hidden" });
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

	async searchByTitle(title: string): Promise<void> {
		await fillSearchAndWaitForUrl(this.page, BASE_PATH, title);
	}

	rowByTitle(title: string): Locator {
		return this.page.getByRole("row").filter({ hasText: title });
	}

	async openDeleteDialog(title: string): Promise<Locator> {
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete opportunity/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	// ---------------------------------------------------------------------------
	// Details page — navigation
	// ---------------------------------------------------------------------------

	async gotoEditFromList(title: string): Promise<void> {
		await this.searchByTitle(title);
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			this.page.waitForURL("**/edit"),
			this.page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
	}

	async gotoDetailsFromList(title: string): Promise<void> {
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "View" }).click();
		await this.page.waitForURL(`**${BASE_PATH}/**/details`);
	}

	async gotoEditFromDetails(): Promise<void> {
		const editHref = await this.page.getByRole("link", { name: "Edit" }).getAttribute("href");

		if (editHref == null) {
			throw new Error("Could not find edit link on opportunity details page.");
		}

		await this.page.goto(editHref);
		await this.page.waitForURL(`**${BASE_PATH}/**/edit`);
	}

	// ---------------------------------------------------------------------------
	// Details page — status badges
	// ---------------------------------------------------------------------------

	detailsDraftBadge(): Locator {
		return this.page.getByText("Draft", { exact: true });
	}

	detailsPublishedBadge(): Locator {
		return this.page.getByText("Published", { exact: true });
	}

	detailsPublishedWithDraftChangesBadge(): Locator {
		return this.page.getByText("Published with draft changes");
	}

	detailsImage(): Locator {
		return this.page.getByRole("img", { exact: true, name: "E2E Test Asset" });
	}

	detailsRelatedEntity(name: string): Locator {
		return this.page.locator('dt:has-text("Related entities") + dd').getByText(name, {
			exact: true,
		});
	}

	detailsRelatedResource(name: string): Locator {
		return this.page.locator('dt:has-text("Related resources") + dd').getByText(name, {
			exact: true,
		});
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
		return this.page.getByRole("link", { name: "Draft", exact: true });
	}

	versionSelectorPublishedLink(): Locator {
		return this.page.getByRole("link", { name: "Published" });
	}

	// ---------------------------------------------------------------------------
	// List page — status badges within a row
	// ---------------------------------------------------------------------------

	publishedBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Published", { exact: true });
	}

	draftBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Draft", { exact: true });
	}
}
