import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { clearDateSegments } from "@/e2e/lib/fixtures/date-picker";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/website/spotlight-articles";

export class WebsiteSpotlightArticlesPage {
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

	async fillPublicationDate(year: number, month: number, day: number): Promise<void> {
		await clearDateSegments(this.page, "Publication date");

		const group = this.page.getByRole("group", { name: "Publication date" });

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

	// ---------------------------------------------------------------------------
	// Form helpers — tables and their captions
	// ---------------------------------------------------------------------------

	/**
	 * Insert a table at the end of the block, with a header row whose cells are filled.
	 *
	 * The row and column commands live behind a Table button that only appears while the cursor is
	 * inside a table, so its presence is what tells us the table landed.
	 */
	async insertTableAtEnd(headers: [string, string]): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.press("Control+End");
		await editor.press("Enter");

		await this.page.getByRole("button", { name: "Insert", exact: true }).click();
		await this.page.getByRole("menuitem", { name: "Table", exact: true }).click();
		await expect(this.page.getByRole("menu")).toHaveCount(0);

		await expect(this.page.getByRole("button", { name: "Table", exact: true })).toBeVisible();

		const headerCells = editor.locator("th");
		await expect(headerCells).toHaveCount(2);
		await headerCells.nth(0).click();
		await this.page.keyboard.type(headers[0]);
		await headerCells.nth(1).click();
		await this.page.keyboard.type(headers[1]);
	}

	/**
	 * The table's caption, which holds both the caption editor and — once applied — the caption as a
	 * reader sees it. It is a `<caption>` element rather than a paragraph above the table so that it
	 * names the table for a screen reader, and it is also the scope every caption locator needs: the
	 * outer toolbar carries its own Bold, Link and Apply controls.
	 */
	tableCaption(): Locator {
		return this.contentBlockEditor().locator("caption");
	}

	/**
	 * Write a caption exercising everything it can hold: a bold run, a link over text the author
	 * typed, and a footnote of its own.
	 *
	 * The link is applied over a selection walked back from the caret rather than over a click-made
	 * one: with a collapsed selection the popover inserts the url as its own text, which is a
	 * different feature and would not prove the mark survives on an author's words.
	 */
	async addTableCaption(options: {
		boldPrefix: string;
		linkText: string;
		linkUrl: string;
		footnote: string;
	}): Promise<void> {
		const caption = this.tableCaption();
		await caption.getByRole("button", { name: "Add caption" }).click();

		const captionEditor = caption.getByRole("textbox", { name: "Table caption" });
		await captionEditor.click();

		await caption.getByRole("button", { name: "Bold", exact: true }).click();
		await this.page.keyboard.type(options.boldPrefix);
		await caption.getByRole("button", { name: "Bold", exact: true }).click();

		/** The separator is typed on its own, so each run's text is exactly what is asserted on. */
		await this.page.keyboard.type(" ");
		await this.page.keyboard.type(options.linkText);

		let remaining = options.linkText.length;
		while (remaining > 0) {
			await this.page.keyboard.press("Shift+ArrowLeft");
			remaining -= 1;
		}

		await caption.getByRole("button", { name: "Link", exact: true }).click();
		const linkForm = this.page
			.locator("form")
			.filter({ has: this.page.getByPlaceholder("https://example.com") });
		await expect(linkForm).toHaveCount(1);
		await linkForm.getByPlaceholder("https://example.com").fill(options.linkUrl);
		await linkForm.getByRole("button", { name: "Apply" }).click();
		await expect(linkForm).toHaveCount(0);

		/** Collapse to the end of the linked run, so the marker lands after it rather than inside. */
		await captionEditor.press("ArrowRight");

		await caption.getByRole("button", { name: "Footnote", exact: true }).click();
		await this.fillFootnote(options.footnote);

		await caption.getByRole("button", { name: "Apply", exact: true }).click();
		await expect(caption.getByRole("textbox", { name: "Table caption" })).toHaveCount(0);
	}

	/**
	 * Fill the note of the marker just inserted. The marker's node view opens its own editor as it
	 * mounts, in a popover — outside the caption, so this is located from the page.
	 */
	private async fillFootnote(text: string): Promise<void> {
		const noteForm = this.page
			.locator("form")
			.filter({ has: this.page.getByRole("textbox", { name: "Footnote text" }) });
		await expect(noteForm).toHaveCount(1);
		await noteForm.getByRole("textbox", { name: "Footnote text" }).fill(text);
		await noteForm.getByRole("button", { name: "Apply" }).click();
		await expect(noteForm).toHaveCount(0);
	}

	/**
	 * The caption as the editor renders it once applied: the marks as elements, and the footnote as
	 * the same empty `<sup>` the prose uses, numbered by a counter.
	 */
	async expectTableCaption(options: {
		boldPrefix: string;
		linkText: string;
		linkUrl: string;
	}): Promise<void> {
		const caption = this.tableCaption();
		await expect(caption.locator("strong")).toHaveText(options.boldPrefix);
		await expect(caption.locator("a")).toHaveText(options.linkText);
		await expect(caption.locator("a")).toHaveAttribute("href", options.linkUrl);
		await expect(caption.locator("sup[data-footnote]")).toHaveCount(1);
	}

	async selectImageFromMediaLibrary(assetLabel: string): Promise<void> {
		await this.page.getByRole("button", { name: /^(Select|Change) image$/ }).click();
		await this.page.waitForSelector('[role="dialog"]');
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
	}

	async removeFirstContentBlock(): Promise<void> {
		await this.page.getByRole("button", { name: "Remove block" }).first().click();
		const dialog = this.page.getByRole("alertdialog", { name: "Remove block" });
		await dialog.getByRole("button", { name: "Remove" }).click();
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
	// Edit page — contributors tab
	// ---------------------------------------------------------------------------

	async goToContributorsTab(): Promise<void> {
		await this.page.getByRole("tab", { name: "Contributors" }).click();
	}

	contributorsTable(): Locator {
		return this.page.getByRole("grid", { name: "contributors" });
	}

	private async selectContributorPerson(personName: string): Promise<void> {
		await this.page.getByRole("button", { name: "No person selected" }).click();
		// `fill` rather than typing into the auto-focused field: `AsyncSelect` keeps its search text in
		// component state, which closing the popover does not reset.
		const search = this.page
			.getByRole("dialog", { name: "No person selected" })
			.getByRole("searchbox");
		await search.fill(personName);
		await search.press("Enter");
		const option = this.page.getByRole("option", { name: personName });
		await option.waitFor({ state: "visible" });
		await option.click();
		// Wait for the selection to commit — a click landing mid-refresh leaves the field empty, so the
		// submit fails client validation and fires no POST.
		await this.page
			.getByRole("button", { name: "No person selected" })
			.waitFor({ state: "hidden" });
	}

	private async selectContributorRole(role: string): Promise<void> {
		const control = this.page
			.locator('[data-slot="control"]')
			.filter({ has: this.page.getByText("Role", { exact: true }) });
		await control.locator("button").click();
		await this.page.getByRole("option", { name: role, exact: true }).click();
	}

	/** Adds a contributor from the edit page's contributors tab and waits for the row to appear. */
	async addContributor(personName: string, role: string): Promise<void> {
		await this.selectContributorPerson(personName);
		await this.selectContributorRole(role);
		await this.page.getByRole("button", { name: "Add contributor", exact: true }).click();
		await expect(
			this.contributorsTable().getByRole("row").filter({ hasText: personName }),
		).toBeVisible();
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
		return this.page.getByRole("dialog", { name: /Delete spotlight article/i });
	}

	async confirmDelete(dialog: Locator): Promise<void> {
		await dialog.getByRole("button", { name: "Delete" }).click();
	}

	// ---------------------------------------------------------------------------
	// Details page — navigation
	// ---------------------------------------------------------------------------

	async gotoDetailsFromList(title: string): Promise<void> {
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await this.page.getByRole("menuitem", { name: "View" }).click();
		await this.page.waitForURL(`**${BASE_PATH}/**/details`);
	}

	async gotoEditFromDetails(): Promise<void> {
		const editHref = await this.page.getByRole("link", { name: "Edit" }).getAttribute("href");

		if (editHref == null) {
			throw new Error("Could not find edit link on spotlight article details page.");
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
	// Details page — contributors
	// ---------------------------------------------------------------------------

	detailsContributors(): Locator {
		return this.page.locator('dt:has-text("Contributors") + dd');
	}

	detailsContributor(personName: string): Locator {
		return this.detailsContributors().getByRole("listitem").filter({ hasText: personName });
	}

	detailsContributorLink(personName: string): Locator {
		return this.detailsContributors().getByRole("link", { name: personName });
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
