import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { clearDateSegments } from "@/e2e/lib/fixtures/date-picker";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/administrator/projects";

export class AdminProjectsPage {
	readonly page: Page;
	readonly workerIndex: number;

	readonly projectsTable: Locator;
	readonly newProjectLink: Locator;

	constructor(page: Page, workerIndex: number) {
		this.page = page;
		this.workerIndex = workerIndex;
		this.projectsTable = page.getByRole("table");
		this.newProjectLink = page.getByRole("link", { name: "New" });
	}

	get workerPrefix(): string {
		return `[e2e-worker-${String(this.workerIndex)}]`;
	}

	/** Navigate to the projects list page. */
	async goto(): Promise<void> {
		await this.page.goto(BASE_PATH);
		await this.page.waitForURL(`**${BASE_PATH}`);
	}

	/** Navigate to the create project form. */
	async gotoCreate(): Promise<void> {
		await this.page.goto(`${BASE_PATH}/create`);
	}

	/** Navigate to the edit form for a project identified by its slug. */
	async gotoEdit(slug: string): Promise<void> {
		await this.page.goto(`${BASE_PATH}/${slug}/edit`);
	}

	// ---------------------------------------------------------------------------
	// Form helpers
	// ---------------------------------------------------------------------------

	async fillName(name: string): Promise<void> {
		await this.page.getByRole("main").getByLabel("Name").fill(name);
	}

	async fillAcronym(acronym: string): Promise<void> {
		await this.page.locator('input[name="acronym"]').fill(acronym);
	}

	async fillFunding(funding: number): Promise<void> {
		await this.page.getByLabel("Funding").fill(String(funding));
	}

	async fillTopic(topic: string): Promise<void> {
		await this.page.locator('input[name="topic"]').fill(topic);
	}

	async fillCall(call: string): Promise<void> {
		await this.page.locator('input[name="call"]').fill(call);
	}

	async fillSummary(text: string): Promise<void> {
		await this.page.getByLabel("Summary").fill(text);
	}

	async selectFirstScope(): Promise<void> {
		const scopeControl = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Scope", { exact: true }) });
		await scopeControl.locator("button").click();
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

	async selectImageFromMediaLibrary(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: "Select image" }).click();
		await this.page.waitForSelector('[role="dialog"]');
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
	}

	async fillDescription(text: string): Promise<void> {
		const editor = this.page.getByRole("textbox", { name: "Description" });
		await editor.click();
		await this.page.keyboard.type(text);
	}

	async insertImageInDescription(assetLabel: string): Promise<void> {
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

	async typeDescriptionAfterImage(text: string): Promise<void> {
		const editor = this.page.getByRole("textbox", { name: "Description" });
		await editor.press("ArrowRight");
		await this.page.keyboard.type(text);
	}

	async selectFirstOptionInControl(label: string): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator("label").filter({ hasText: label }) })
			.last();
		await control.getByRole("button").click();
		await this.page.getByRole("option").first().click();
	}

	async clearDatePicker(label: string): Promise<void> {
		await clearDateSegments(this.page, label);
	}

	async removeImage(): Promise<void> {
		await this.page.getByRole("button", { name: "Remove image" }).click();
	}

	async removeAllTagsInControl(label: string): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText(label, { exact: true }) })
			.last();
		// Remove tag's aria-label extracts as "ui" (i18n build bug); match by slot="remove" instead.
		const removeButtons = control.locator('button[slot="remove"]');
		while ((await removeButtons.count()) > 0) {
			await removeButtons.first().click();
		}
	}

	async createSocialMediaInForm(name: string, url: string): Promise<void> {
		await this.page.getByRole("button", { name: "Create social media" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Create social media" });
		await dialog.getByLabel("Name", { exact: true }).fill(name);
		await dialog.getByLabel("URL").fill(url);
		const typeControl = dialog
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator('[data-slot="label"]', { hasText: "Type" }) });
		await typeControl.locator("button[aria-expanded]:not([slot])").click();
		await this.page.getByRole("option").first().click();
		await dialog.getByRole("button", { name: "Create" }).click();
		await dialog.waitFor({ state: "hidden" });
		await expect(this.page.getByText(name, { exact: true })).toBeVisible();
	}

	async goToProjectPartnersTab(): Promise<void> {
		await this.page.getByRole("tab", { name: "Project partners" }).click();
	}

	projectPartnersTable(): Locator {
		return this.page.getByRole("grid", { name: "project partners" });
	}

	async addProjectPartner(unitName: string): Promise<void> {
		await this.page.getByRole("button", { name: "Add partner" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Add partner" });
		const partnerControl = dialog
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator('[data-slot="label"]', { hasText: "Partner" }) });
		await partnerControl.locator("button[aria-expanded]:not([slot])").click();
		await this.page.getByRole("searchbox").fill(unitName);
		await this.page.keyboard.press("Enter");
		const option = this.page.getByRole("option", { name: unitName, exact: true });
		await expect(option).toBeVisible();
		await option.click();
		const roleControl = dialog
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator('[data-slot="label"]', { hasText: "Role" }) });
		await roleControl.locator("button[aria-expanded]:not([slot])").click();
		await this.page.getByRole("option").first().click();
		await this.fillProjectPartnerDate("Start date", 2024, 3, 1);
		await this.fillProjectPartnerDate("End date", 2024, 9, 30);
		await waitForActionSuccess({
			page: this.page,
			trigger: async () => {
				await dialog.getByRole("button", { name: "Save" }).click();
			},
		});
		await dialog.waitFor({ state: "hidden" });
		await expect(this.page.getByText(unitName, { exact: true })).toBeVisible();
	}

	async clickEditProjectPartner(): Promise<void> {
		await this.projectPartnersTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await this.page.getByRole("menuitem", { name: "Edit partner" }).click();
	}

	async fillProjectPartnerEditDate(
		label: string,
		year: number,
		month: number,
		day: number,
	): Promise<void> {
		const dialog = this.page.getByRole("dialog", { name: "Edit partner" });
		await this.fillProjectPartnerDate(label, year, month, day, dialog);
	}

	async saveProjectPartnerEdit(): Promise<void> {
		const dialog = this.page.getByRole("dialog", { name: "Edit partner" });
		await waitForActionSuccess({
			page: this.page,
			trigger: async () => {
				await dialog.getByRole("button", { name: "Save" }).click();
			},
		});
		await dialog.waitFor({ state: "hidden" });
	}

	async clickDeleteProjectPartner(): Promise<void> {
		await this.projectPartnersTable()
			.getByRole("button", { name: "Open actions menu" })
			.first()
			.click();
		await this.page.getByRole("menuitem", { name: "Delete partner" }).click();
	}

	async confirmDeleteProjectPartner(): Promise<void> {
		const dialog = this.page.getByRole("alertdialog", { name: "Delete project partner" });
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	private async fillProjectPartnerDate(
		label: string,
		year: number,
		month: number,
		day: number,
		scope: Locator = this.page.getByRole("dialog", { name: "Add partner" }),
	): Promise<void> {
		const group = scope.getByRole("group", { name: label });
		await group.getByRole("spinbutton", { name: /day/i }).click();
		await this.page.keyboard.type(String(day).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /month/i }).click();
		await this.page.keyboard.type(String(month).padStart(2, "0"));
		await group.getByRole("spinbutton", { name: /year/i }).click();
		await this.page.keyboard.type(String(year));
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

	projectRowByName(name: string): Locator {
		return this.page.getByRole("row").filter({ hasText: name });
	}

	async openDeleteDialog(name: string): Promise<Locator> {
		const row = this.projectRowByName(name);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete project/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
	}

	// ---------------------------------------------------------------------------
	// Details page — navigation
	// ---------------------------------------------------------------------------

	async gotoDetailsFromList(name: string): Promise<void> {
		const row = this.projectRowByName(name);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "View" }).click();
		await this.page.waitForURL(`**${BASE_PATH}/**/details`);
	}

	async gotoEditFromDetails(): Promise<void> {
		const editHref = await this.page.getByRole("link", { name: "Edit" }).getAttribute("href");

		if (editHref == null) {
			throw new Error("Could not find edit link on project details page.");
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
	// List page — status badges within a row
	// ---------------------------------------------------------------------------

	publishedBadgeInRow(name: string): Locator {
		return this.projectRowByName(name).getByText("Published", { exact: true });
	}

	draftBadgeInRow(name: string): Locator {
		return this.projectRowByName(name).getByText("Draft", { exact: true });
	}
}
