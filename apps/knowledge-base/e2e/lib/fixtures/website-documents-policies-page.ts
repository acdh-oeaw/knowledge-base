import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { clearDateSegments } from "@/e2e/lib/fixtures/date-picker";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/website/documents-policies";

export class WebsiteDocumentsPoliciesPage {
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

	async fillUrl(url: string): Promise<void> {
		await this.page.getByLabel("URL").fill(url);
	}

	async selectFirstGroup(): Promise<void> {
		const groupControl = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Group", { exact: true }) });
		await groupControl.locator("button").click();
		await this.page.getByRole("option").nth(1).click();
	}

	async selectGroup(label: string): Promise<void> {
		await this.page.getByRole("button", { name: "Group" }).click();
		await this.page.getByRole("option", { name: label, exact: true }).click();
	}

	async selectNoGroup(): Promise<void> {
		const groupControl = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Group", { exact: true }) });
		await groupControl.locator("button").click();
		await this.page.getByRole("option", { name: "None", exact: true }).click();
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

	async selectDocumentFromMediaLibrary(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: "Select image" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
		await this.page.getByText(assetLabel, { exact: true }).waitFor({ state: "visible" });
		await expect(this.page.locator('input[name="documentKey"]')).not.toHaveValue("");
	}

	async clearDatePicker(label: string): Promise<void> {
		await clearDateSegments(this.page, label);
	}

	async removeFirstContentBlock(): Promise<void> {
		await this.page.getByRole("button", { name: "Remove block" }).first().click();
		const dialog = this.page.getByRole("alertdialog", { name: "Remove block" });
		await dialog.getByRole("button", { name: "Remove" }).click();
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

	async searchByTitle(title: string): Promise<void> {
		const searchbox = this.page.getByRole("searchbox");
		if (await searchbox.isVisible()) {
			await fillSearchAndWaitForUrl(this.page, BASE_PATH, title);
		} else {
			await expect(this.rowByTitle(title)).toBeVisible();
		}
	}

	rowByTitle(title: string): Locator {
		return this.page
			.getByText(title, { exact: true })
			.locator("xpath=ancestor::div[contains(@class, 'rounded-md')][1]");
	}

	async openEditDialog(title: string): Promise<void> {
		await this.searchByTitle(title);
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Edit" }).click();
		await this.page
			.getByRole("dialog", { name: /Edit document or policy/i })
			.waitFor({ state: "visible" });
	}

	async submitEditDialog(): Promise<void> {
		const dialog = this.page.getByRole("dialog", { name: /Edit document or policy/i });
		await dialog.getByRole("button", { name: /^Save/ }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async openDeleteDialog(title: string): Promise<Locator> {
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Delete" }).click();
		return this.page.getByRole("dialog", { name: /Delete document or policy/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	// ---------------------------------------------------------------------------
	// Group management
	// ---------------------------------------------------------------------------

	groupSection(label: string): Locator {
		return this.page
			.getByRole("heading", { name: label, exact: true })
			.locator("xpath=ancestor::div[contains(@class, 'mbe-6')][1]");
	}

	async groupLabels(): Promise<Array<string>> {
		return this.page.getByRole("heading", { level: 2 }).allTextContents();
	}

	async createGroup(label: string): Promise<void> {
		await this.page.getByRole("button", { name: "New group" }).click();
		const dialog = this.page.getByRole("dialog", { name: "New group" });
		await dialog.getByLabel("Label").fill(label);
		await dialog.getByRole("button", { name: "Create" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async editGroup(currentLabel: string, updatedLabel: string): Promise<void> {
		await this.groupSection(currentLabel).getByRole("button", { name: "Edit group" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Edit group" });
		const label = dialog.getByLabel("Label");
		await label.clear();
		await label.fill(updatedLabel);
		await dialog.getByRole("button", { name: "Save" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	async moveGroup(label: string, direction: "up" | "down"): Promise<void> {
		const action = direction === "up" ? "Move group up" : "Move group down";
		const [response] = await Promise.all([
			this.page.waitForResponse(
				(candidate) =>
					candidate.request().method() === "POST" &&
					new URL(candidate.url()).pathname === BASE_PATH,
			),
			this.groupSection(label).getByRole("button", { name: action }).click(),
		]);

		expect(response.ok(), `Move group action failed with HTTP ${String(response.status())}.`).toBe(
			true,
		);
	}

	async deleteGroup(label: string): Promise<void> {
		await this.groupSection(label).getByRole("button", { name: "Delete group" }).click();
		const dialog = this.page.getByRole("dialog", { name: /Delete group/i });
		await dialog.getByRole("button", { name: "Delete" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	// ---------------------------------------------------------------------------
	// Details page — navigation
	// ---------------------------------------------------------------------------

	async gotoDetailsFromList(title: string): Promise<void> {
		const row = this.rowByTitle(title);
		const editHref = await row.getByRole("link", { name: "Content" }).getAttribute("href");

		if (editHref == null) {
			throw new Error(`Could not find content edit link for document or policy "${title}".`);
		}

		await this.page.goto(editHref.replace(/\/edit$/, "/details"));
		await this.page.waitForURL(`**${BASE_PATH}/**/details`);
	}

	async gotoEditFromDetails(): Promise<void> {
		const editHref = await this.page.getByRole("link", { name: "Edit" }).getAttribute("href");

		if (editHref == null) {
			throw new Error("Could not find edit link on document or policy details page.");
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

	publishedBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Published", { exact: true });
	}

	draftBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Draft", { exact: true });
	}
}
