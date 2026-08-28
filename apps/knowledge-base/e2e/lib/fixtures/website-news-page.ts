import { type Locator, type Page, expect } from "@playwright/test";

import { waitForActionRedirect } from "@/e2e/lib/fixtures/action-redirect";
import { clearDateSegments } from "@/e2e/lib/fixtures/date-picker";
import { dragGridRowDownByName } from "@/e2e/lib/fixtures/reorder";
import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const BASE_PATH = "/en/dashboard/website/news";

export class WebsiteNewsPage {
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

	private relatedEntitiesDialog(): Locator {
		return this.page
			.getByRole("dialog")
			.filter({ has: this.page.getByRole("listbox", { name: "Related entities" }) });
	}

	private relatedEntitiesControl(): Locator {
		return this.relatedEntitiesSection().getByRole("button", { name: "Add related entity" });
	}

	private async closeRelatedEntitiesDialog(dialog: Locator): Promise<void> {
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

	async removeRelatedEntity(entityName: string): Promise<void> {
		// Selected items render as rows in an orderable grid list; each row has a drag handle
		// (slot="drag") plus a Remove button. The button aria-labels are not locator-friendly in the
		// e2e build, so target the row by name and the non-drag button.
		const row = this.relatedEntitiesSection().getByRole("row", { name: entityName });
		await row.waitFor({ state: "visible" });
		await row.locator('button:not([slot="drag"])').click();
		await row.waitFor({ state: "hidden" });
	}

	/** Names of the currently-selected related entities, in display order. */
	async getRelatedEntityNames(): Promise<Array<string>> {
		const rows = this.relatedEntitiesSection().getByRole("row");
		const texts = await rows.allInnerTexts();
		return texts.map((text) => text.trim()).filter((text) => text !== "");
	}

	/** Drag a related-entity row one position down past the row below it. */
	async moveRelatedEntityDown(entityName: string): Promise<void> {
		await dragGridRowDownByName(
			this.page,
			this.relatedEntitiesSection().getByRole("row"),
			entityName,
		);
	}

	/**
	 * A dismissed menu stays mounted while it animates out and its overlay swallows clicks aimed at
	 * the page underneath, so every block-insert flow that clicks into the form it just opened has to
	 * wait for the menu to actually leave the DOM first.
	 */
	private async waitForMenuToClose(): Promise<void> {
		await expect(this.page.getByRole("menu")).toHaveCount(0);
	}

	private contentBlockEditor(): Locator {
		return this.page.getByRole("textbox", { name: "Content" });
	}

	/**
	 * Pick an entry from the richtext toolbar's insert menu. Every block the editor can insert lives
	 * there rather than in a button of its own, so each insertion is two steps: open, then choose.
	 */
	private async chooseInsert(name: string): Promise<void> {
		await this.page.getByRole("button", { name: "Insert", exact: true }).click();
		await this.page.getByRole("menuitem", { name, exact: true }).click();
		await this.waitForMenuToClose();
	}

	async addContentBlock(text: string): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();
		await this.contentBlockEditor().fill(text);
	}

	async addContentWithCallout(options: {
		above: string;
		below: string;
		body: string;
		title: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.fill(options.above);
		await editor.press("Enter");
		await editor.pressSequentially(options.below);

		/** Insert at the end of the first paragraph, between the two rich-text runs. */
		await editor.press("Control+Home");
		await editor.press("End");
		await this.chooseInsert("Callout");

		await this.fillInlineCallout({
			title: options.title,
			body: options.body,
			intent: "Warning",
		});
	}

	/** Insert a button-link inline node at the current cursor via the toolbar + popover form. */
	private async insertButtonLink(options: {
		label: string;
		url: string;
		variant?: "Primary" | "Secondary" | "Outline";
	}): Promise<void> {
		await this.chooseInsert("Button");

		/** Scope to the popover's form; the main editor textbox is named "Content", not "Label". */
		const form = this.page
			.locator("form")
			.filter({ has: this.page.getByRole("textbox", { name: "Label" }) });

		/**
		 * A dismissed popover stays mounted for the length of its exit animation, so inserting a second
		 * button while the first is still fading matches two forms and fails on strict mode. Wait for
		 * this one to be alone before filling it, and for it to detach after applying, so each
		 * insertion both starts and leaves from a single known state.
		 */
		await expect(form).toHaveCount(1);

		await form.getByRole("textbox", { name: "Label" }).fill(options.label);
		await form.getByRole("textbox", { name: "URL" }).fill(options.url);
		if (options.variant != null) {
			await form.getByRole("radio", { name: options.variant, exact: true }).click();
		}
		await form.getByRole("button", { name: "Apply" }).click();

		await expect(form).toHaveCount(0);
	}

	/**
	 * Build a content block with two standalone button links — each alone in its own paragraph, so it
	 * reads as a block-level CTA — plus one button link inline within a run of text. `Control+End`
	 * moves the caret to the document end between insertions so we never click onto an existing
	 * button node (which would re-open its popover).
	 */
	async addContentWithButtonLinks(options: {
		intro: string;
		primary: { label: string; url: string };
		secondary: { label: string; url: string };
		inline: { before: string; label: string; url: string; after: string };
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.click();
		await editor.pressSequentially(options.intro);

		await editor.press("Control+End");
		await editor.press("Enter");
		await this.insertButtonLink({ ...options.primary, variant: "Primary" });

		await editor.press("Control+End");
		await editor.press("Enter");
		await this.insertButtonLink({ ...options.secondary, variant: "Outline" });

		await editor.press("Control+End");
		await editor.press("Enter");
		await editor.pressSequentially(options.inline.before);
		await this.insertButtonLink({
			label: options.inline.label,
			url: options.inline.url,
			variant: "Secondary",
		});
		await editor.press("Control+End");
		await editor.pressSequentially(options.inline.after);
	}

	private imageBlock(): Locator {
		return this.page.getByLabel("Image block", { exact: true });
	}

	/**
	 * Add a content block holding a paragraph followed by an inline image node. The image is a node
	 * inside the unified richtext document, not a block of its own — it is only split back out into
	 * an `image` content block on save.
	 */
	async addContentWithImage(options: { text: string; assetLabel: string }): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.click();
		await editor.pressSequentially(options.text);
		await editor.press("Control+End");
		await editor.press("Enter");

		/** The insert menu opens the picker directly; the image lands finished. */
		await this.chooseInsert("Image");
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		const asset = dialog.getByRole("gridcell", { name: options.assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
		await expect(this.imageBlock()).toBeVisible();
	}

	/** Open the image node's settings, pick a layout and apply it. */
	async setImageLayout(layout: string): Promise<void> {
		const block = this.imageBlock();
		await block.dblclick();
		await block.getByRole("radio", { name: layout, exact: true }).click();
		await block.getByRole("button", { name: "Apply" }).click();
		await expect(block.getByRole("button", { name: "Apply" })).toBeHidden();
	}

	/**
	 * Assert the layout the image node's settings currently show. This reads the _editor_ state, so
	 * it fails if loading an entity drops the stored layout — the half of the round trip a database
	 * assertion after saving cannot distinguish from the editor never having had it.
	 */
	async expectImageLayout(layout: string): Promise<void> {
		const block = this.imageBlock();
		await block.dblclick();
		await expect(block.getByRole("radio", { name: layout, exact: true })).toBeChecked();
		await block.getByRole("button", { name: "Cancel" }).click();
	}

	/**
	 * Set the image node's caption behaviour. `text` is only meaningful for "Custom caption"; the
	 * other two modes have no editor to type into.
	 */
	async setImageCaptionMode(mode: string, text?: string): Promise<void> {
		const block = this.imageBlock();
		await block.dblclick();
		await block.getByRole("radio", { name: mode, exact: true }).click();
		if (text != null) {
			await block.getByRole("textbox", { name: "Custom caption" }).fill(text);
		}
		await block.getByRole("button", { name: "Apply" }).click();
		await expect(block.getByRole("button", { name: "Apply" })).toBeHidden();
	}

	async expectImageCaptionMode(mode: string): Promise<void> {
		const block = this.imageBlock();
		await block.dblclick();
		await expect(block.getByRole("radio", { name: mode, exact: true })).toBeChecked();
		await block.getByRole("button", { name: "Cancel" }).click();
	}

	/** Insert a 3x2 table with a header row at the cursor, then fill the two header cells. */
	async insertTable(headers: [string, string]): Promise<void> {
		await this.chooseInsert("Table");

		/**
		 * The row and column commands live behind a Table button that only appears while the cursor is
		 * inside a table — so its presence is what tells us the table landed.
		 */
		await expect(this.page.getByRole("button", { name: "Table", exact: true })).toBeVisible();

		const editor = this.contentBlockEditor();
		const headerCells = editor.locator("th");
		await expect(headerCells).toHaveCount(2);
		await headerCells.nth(0).click();
		await this.page.keyboard.type(headers[0]);
		await headerCells.nth(1).click();
		await this.page.keyboard.type(headers[1]);
	}

	/**
	 * Run commands from the table menu. Choosing an entry closes the menu — it is a menu like the
	 * insert one, not a panel that stays open — so each command reopens it.
	 */
	async runTableCommands(labels: ReadonlyArray<string>): Promise<void> {
		for (const label of labels) {
			await this.page.getByRole("button", { name: "Table", exact: true }).click();
			await this.page.getByRole("menuitem", { name: label, exact: true }).click();
			await this.waitForMenuToClose();
		}
	}

	/** Put the cursor in the table's first body cell, so row and column commands act from there. */
	async clickFirstTableBodyCell(): Promise<void> {
		await this.contentBlockEditor().locator("td").first().click();
	}

	/** Toggle an inline mark over whatever is selected, from the toolbar. */
	async toggleMark(name: "Bold" | "Italic" | "Code"): Promise<void> {
		await this.page.getByRole("button", { name, exact: true }).click();
	}

	/**
	 * Retype the block holding the cursor through the toolbar's text style menu. The styles are
	 * alternatives to one another, so the menu offers them as radios rather than as plain commands.
	 */
	async applyTextStyle(name: string): Promise<void> {
		await this.textStyleTrigger().click();
		await this.page.getByRole("menuitemradio", { name, exact: true }).click();
		await this.waitForMenuToClose();
	}

	/**
	 * The style the toolbar reports for the block at the cursor — named on the trigger, and marked
	 * inside the menu, both of which are read off the same editor state.
	 */
	async expectTextStyle(name: string): Promise<void> {
		await expect(this.textStyleTrigger()).toHaveAccessibleName(`Text style: ${name}`);

		await this.textStyleTrigger().click();
		await expect(this.page.getByRole("menuitemradio", { name, exact: true })).toHaveAttribute(
			"aria-checked",
			"true",
		);
		await this.page.keyboard.press("Escape");
		await this.waitForMenuToClose();
	}

	/** The element a run ends up in, so retyping a block is checked in the document as well. */
	async expectBlockTag(tag: "p" | "h2" | "h3" | "h4", text: string): Promise<void> {
		await expect(this.contentBlockEditor().locator(tag).filter({ hasText: text })).toHaveCount(1);
	}

	/** Named by its purpose rather than by the style it currently shows, which changes as we go. */
	private textStyleTrigger(): Locator {
		return this.page.getByRole("button", { name: /^Text style: / });
	}

	/** The text the given mark renders over, so a failure names the step that lost it. */
	async expectMarkedText(tag: "strong" | "em" | "code" | "a", text: string): Promise<void> {
		await expect(this.contentBlockEditor().locator(tag).filter({ hasText: text })).toHaveCount(1);
	}

	/**
	 * The anchor the editor renders for a link run — for reading the attributes it carries, which
	 * `expectMarkedText` deliberately says nothing about.
	 */
	contentBlockLink(text: string): Locator {
		return this.contentBlockEditor().locator("a").filter({ hasText: text });
	}

	/**
	 * Link the current selection to an external url through the toolbar's link popover — the plain
	 * kind that stores an href, as opposed to the document and entity links that store a reference.
	 */
	async insertUrlLink(url: string): Promise<void> {
		await this.page.getByRole("button", { name: "Link", exact: true }).click();
		const form = this.linkPopoverForm();
		await form.getByPlaceholder("https://example.com").fill(url);
		await form.getByRole("button", { name: "Apply" }).click();
		await expect(form).toHaveCount(0);
	}

	/**
	 * A dismissed popover stays mounted for the length of its exit animation, so this is also what
	 * the callers wait on to know the previous one has gone.
	 */
	private linkPopoverForm(): Locator {
		return this.page
			.locator("form")
			.filter({ has: this.page.getByPlaceholder("https://example.com") });
	}

	/**
	 * Link the current selection to a stored document. No href is written — the asset key is, and
	 * read paths resolve it, so the link survives the file being replaced.
	 */
	async insertDocumentLink(assetLabel: string): Promise<void> {
		await this.chooseInsert("Link to document");
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		await dialog.getByRole("tab", { name: "Upload" }).click();
		await expect(dialog.locator('input[type="file"]')).toHaveAttribute(
			"accept",
			/application\/pdf/,
		);
		await dialog.getByRole("tab", { name: "Select" }).click();
		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	/** Link the current selection to another entity, stored as a document id rather than a path. */
	async insertEntityLink(entityName: string): Promise<void> {
		await this.chooseInsert("Link to page");
		await this.pickEntityInLinkDialog(entityName);
	}

	/**
	 * Choose an entity in the "Link to a page" dialog, whichever opened it — the insert menu to make
	 * a link, or the link popover to point an existing one somewhere else.
	 */
	private async pickEntityInLinkDialog(entityName: string): Promise<void> {
		/** Scoped to the modal: the toolbar's own link popover trigger is also named "Link". */
		const dialog = this.page.getByRole("dialog").filter({ hasText: "Link to a page" });
		await dialog.waitFor({ state: "visible" });

		const control = dialog
			.locator('[data-slot="control"]')
			.filter({ has: this.page.locator("label").filter({ hasText: "Page to link to" }) })
			.last();
		await control.getByRole("button").click();

		/** The options popover portals out of the modal, so it is located on the page. */
		await this.page.getByRole("searchbox").last().fill(entityName);
		await this.page.getByRole("option", { name: entityName, exact: true }).click();

		await dialog.getByRole("button", { name: "Link", exact: true }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	/** Put the caret inside a link that stores a reference, so the toolbar acts on that link. */
	async placeCaretInTargetLink(kind: "asset" | "entity"): Promise<void> {
		await this.contentBlockEditor().locator(`a[data-target-kind="${kind}"]`).first().click();
	}

	/**
	 * Open the toolbar's link popover on the link at the cursor, and check it offers the target panel
	 * rather than the url form: a link that stores a reference has no href to show, and reporting the
	 * wrong kind here is how the popover would offer the wrong picker.
	 *
	 * Located by the note it shows rather than by a role — the popover renders its content directly,
	 * with no dialog of its own, which is why `linkPopoverForm` goes by its input as well.
	 */
	async openLinkTargetPopover(kind: "document" | "page", targetLabel?: string): Promise<void> {
		await this.page.getByRole("button", { name: "Link", exact: true }).click();

		/**
		 * With a label, the popover has to name the target, not merely its kind — the mark holds only a
		 * reference, so naming it means the host resolved that reference. Without one, the generic note
		 * is what an unresolvable (or not-yet-loaded) target falls back to.
		 */
		const summary =
			targetLabel != null
				? kind === "document"
					? `Links to the document ${targetLabel}.`
					: `Links to the page ${targetLabel}.`
				: kind === "document"
					? "This link points to a document."
					: "This link points to another page.";

		await expect(this.page.getByText(summary, { exact: true })).toBeVisible();
	}

	/**
	 * Point the document link at the cursor at a different stored document. The link text is left
	 * alone on purpose — the author wrote it, so retargeting must not overwrite it with the new
	 * document's label.
	 *
	 * `currentLabel` is the document the link points at now: the picker opens on it, so an author can
	 * see what they are replacing rather than an empty grid.
	 */
	async changeDocumentLink(assetLabel: string, currentLabel?: string): Promise<void> {
		await this.openLinkTargetPopover("document", currentLabel);
		await this.page.getByRole("button", { name: "Change document", exact: true }).click();

		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });

		if (currentLabel != null) {
			/**
			 * `aria-selected` sits on the row, not on the cell inside it — the cell is what the clicks
			 * below target, because that is what carries the label.
			 */
			const currentRow = dialog
				.getByRole("row")
				.filter({ has: this.page.getByRole("gridcell", { name: currentLabel }) });
			await expect(currentRow).toHaveAttribute("aria-selected", "true");
		}

		const asset = dialog.getByRole("gridcell", { name: assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });
	}

	/** Point the entity link at the cursor at a different page. */
	async changeEntityLink(entityName: string, currentName?: string): Promise<void> {
		await this.openLinkTargetPopover("page", currentName);
		await this.page.getByRole("button", { name: "Change page", exact: true }).click();

		if (currentName != null) {
			/** The picker opens on the page the link points at now, rather than on an empty select. */
			const dialog = this.page.getByRole("dialog").filter({ hasText: "Link to a page" });
			await dialog.waitFor({ state: "visible" });
			await expect(dialog.getByText(currentName, { exact: true }).first()).toBeVisible();
		}

		await this.pickEntityInLinkDialog(entityName);
	}

	/**
	 * The preview's rendering of an entity link. It names the page the link leads to but stays
	 * unclickable — the dashboard resolves the title without reproducing the website's url rules — so
	 * the title attribute is where the resolution shows.
	 */
	async expectEntityLinkPreviewTarget(linkText: string, entityName: string): Promise<void> {
		await expect(this.page.getByText(linkText, { exact: true })).toHaveAttribute(
			"title",
			`Links to “${entityName}” on the website. Its address is resolved when the site renders it.`,
		);
	}

	/** Insert a placeholder-value chip, which stores a kind reference rather than a rendered value. */
	async insertPlaceholderValue(label: string): Promise<void> {
		/** A family of nodes rather than one block, so the insert menu offers them as a submenu. */
		await this.page.getByRole("button", { name: "Insert", exact: true }).click();
		await this.page.getByRole("menuitem", { name: "Placeholder value", exact: true }).click();
		await this.page.getByRole("menuitem", { name: label, exact: true }).click();
		await this.waitForMenuToClose();
	}

	private embedBlock(): Locator {
		return this.page.getByLabel("Embed block", { exact: true });
	}

	/** Insert an inline embed node and fill its settings form. */
	async insertEmbed(options: { url: string; title: string; caption: string }): Promise<void> {
		await this.chooseInsert("Embed");

		const block = this.embedBlock();
		await block.getByRole("textbox", { name: "URL" }).fill(options.url);
		await block.getByRole("textbox", { name: "Title" }).fill(options.title);
		await block.getByRole("textbox", { name: "Caption" }).fill(options.caption);
		await block.getByRole("button", { name: "Apply" }).click();
		await expect(block.getByRole("button", { name: "Apply" })).toBeHidden();
	}

	private mediaTextBlock(): Locator {
		return this.page.getByLabel("Media with text block", { exact: true });
	}

	/**
	 * Insert a media_text node at the cursor, pick its image and type its prose. The prose is real
	 * nested document content, so it is typed into the outer editor rather than into a nested form.
	 */
	async insertMediaText(options: {
		assetLabel: string;
		text: string;
		side?: string;
	}): Promise<void> {
		await this.chooseInsert("Media and text");

		const block = this.mediaTextBlock();
		await expect(block).toBeVisible();

		/** `renderImagePicker` is the toolbar-shaped picker, so the trigger reads "Insert image". */
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await block.getByRole("button", { name: "Insert image" }).click();
		await dialog.waitFor({ state: "visible" });
		const asset = dialog.getByRole("gridcell", { name: options.assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });

		if (options.side != null) {
			await block.getByRole("radio", { name: options.side, exact: true }).click();
		}
		await block.getByRole("button", { name: "Apply" }).click();

		/** Scope to the content hole: the media column may also render a caption paragraph. */
		await block.locator("[data-media-text-content] p").first().click();
		await this.page.keyboard.type(options.text);
	}

	async expectMediaTextSide(side: string): Promise<void> {
		const block = this.mediaTextBlock();
		await block.getByRole("button", { name: "Edit media settings" }).click();
		await expect(block.getByRole("radio", { name: side, exact: true })).toBeChecked();
		await block.getByRole("button", { name: "Cancel" }).click();
	}

	private slashMenu(): Locator {
		return this.page.getByRole("listbox", { name: "Insert block" });
	}

	/** Put the cursor on a fresh, empty paragraph at the end of the content block. */
	async startNewParagraph(): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.press("Control+End");
		await editor.press("Enter");
	}

	async clearCurrentParagraph(): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.press("Shift+Home");
		await editor.press("Backspace");
	}

	/** Type at the cursor, leaving whatever the block already holds in place. */
	async typeInContentBlock(text: string): Promise<void> {
		await this.contentBlockEditor().pressSequentially(text);
	}

	/**
	 * Select a whole paragraph by position, the way a triple click does.
	 *
	 * Marks are applied this way rather than by selecting back from the caret, because the caret is
	 * not reliably where the test left it: focus sits on a toolbar button or a closing popover after
	 * each one, and a key sent to the editor can land before the selection is handed back. A click
	 * establishes its own selection and depends on nothing that came before. Editor links do not open
	 * on click, so this is safe over a linked run too.
	 */
	async selectParagraph(index: number): Promise<void> {
		await this.contentBlockEditor().locator("p").nth(index).click({ clickCount: 3 });
	}

	/** Put a collapsed caret in a paragraph, for the insertions that place a node at the cursor. */
	async placeCaretInParagraph(index: number): Promise<void> {
		await this.contentBlockEditor().locator("p").nth(index).click();
	}

	/** The table's shape as rendered. Rows count the header row; `headerCells` is the column count. */
	async expectTableSize(expected: { rows: number; headerCells: number }): Promise<void> {
		const editor = this.contentBlockEditor();
		await expect(editor.locator("tr")).toHaveCount(expected.rows);
		await expect(editor.locator("th")).toHaveCount(expected.headerCells);
	}

	/**
	 * Fill the callout node view that a slash command or the toolbar just inserted.
	 *
	 * Two steps, because a callout is a container: its style and title are settings, committed
	 * through the panel behind the pencil, while its body is ordinary document content typed straight
	 * into the block — the same way the prose around it is.
	 */
	async fillInlineCallout(options: {
		title: string;
		body: string;
		intent?: string;
	}): Promise<void> {
		const callout = this.page.getByLabel("Callout block", { exact: true });
		await expect(callout).toBeVisible();

		await callout.getByRole("button", { name: "Edit callout" }).click();
		if (options.intent != null) {
			await callout.getByText(options.intent, { exact: true }).click();
		}
		await callout.getByRole("textbox", { name: "Title (optional)" }).fill(options.title);
		await callout.getByRole("button", { name: "Apply" }).click();

		await callout.locator("[data-callout-content]").click();
		await this.page.keyboard.type(options.body);
	}

	/**
	 * Fill the accordion node view that a slash command or the toolbar just inserted. It arrives with
	 * one empty panel, so there is a title field and a body to type into without adding anything.
	 */
	async fillInlineAccordion(options: { title: string; body: string }): Promise<void> {
		const accordion = this.page.getByLabel("Accordion block", { exact: true });
		await expect(accordion).toBeVisible();

		await accordion.getByRole("textbox", { name: "Panel title" }).fill(options.title);
		await accordion.locator("[data-accordion-item-content]").first().click();
		await this.page.keyboard.type(options.body);
	}

	/**
	 * Type a `/query` at the cursor and take the block the menu offers first, with Enter — the path
	 * an author actually takes, and the one that has to leave no `/query` text behind.
	 */
	async insertViaSlashMenu(options: { query: string; option: string }): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.pressSequentially(`/${options.query}`);

		const menu = this.slashMenu();
		await expect(menu).toBeVisible();

		/** The query is expected to rank the wanted block first, so Enter is unambiguous. */
		await expect(menu.getByRole("option").first()).toHaveText(options.option);

		await editor.press("Enter");
		await expect(menu).toBeHidden();
	}

	/** Open the menu, walk it with the keyboard, and dismiss it without inserting anything. */
	async expectSlashMenuKeyboardNavigation(options: {
		query: string;
		first: string;
		second: string;
	}): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.pressSequentially(`/${options.query}`);

		const menu = this.slashMenu();
		await expect(menu).toBeVisible();
		await expect(menu.getByRole("option", { selected: true })).toHaveText(options.first);

		await editor.press("ArrowDown");
		await expect(menu.getByRole("option", { selected: true })).toHaveText(options.second);

		await editor.press("Escape");
		await expect(menu).toBeHidden();
	}

	/** Build one content block exercising the table, link-target and placeholder features. */
	async addContentWithRichTextFeatures(options: {
		intro: string;
		headers: [string, string];
		documentLinkText: string;
		documentLabel: string;
		entityName: string;
		placeholderLabel: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();

		/**
		 * Lay out the paragraphs first, then fill each one in. A document link wraps a selection while
		 * an entity link and a placeholder insert at the cursor, and both dialogs hand focus back on
		 * their own schedule — so every one of them is reached by clicking the paragraph it belongs to
		 * rather than by stepping the caret on from wherever the previous one left it.
		 */
		await editor.click();
		await editor.pressSequentially(options.intro);
		await editor.press("Enter");
		await editor.pressSequentially(options.documentLinkText);
		await editor.press("Enter");
		await editor.press("Enter");

		await this.selectParagraph(1);
		await this.insertDocumentLink(options.documentLabel);
		await expect(editor.locator('a[data-target-kind="asset"]')).toHaveText(
			options.documentLinkText,
		);

		await this.placeCaretInParagraph(2);
		await this.insertEntityLink(options.entityName);

		await this.placeCaretInParagraph(3);
		await this.insertPlaceholderValue(options.placeholderLabel);

		/**
		 * A divider holds no text of its own, so it is inserted from the menu rather than typed. The
		 * migrated content brought these in, which makes surviving a round trip the whole point of
		 * having one here.
		 */
		await this.startNewParagraph();
		await this.chooseInsert("Divider");
		await expect(this.contentBlockEditor().locator("hr")).toHaveCount(1);

		/** The table goes last: the cursor ends inside it, and leaving it needs a gap cursor. */
		await this.startNewParagraph();
		await this.insertTable(options.headers);
	}

	/**
	 * Build one content block holding a document link and an entity link, each wrapping a paragraph
	 * of its own so a click anywhere in that paragraph lands inside the link.
	 */
	async addContentWithTargetLinks(options: {
		documentLinkText: string;
		documentLabel: string;
		entityLinkText: string;
		entityName: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();

		await editor.click();
		await editor.pressSequentially(options.documentLinkText);
		await editor.press("Enter");
		await editor.pressSequentially(options.entityLinkText);

		/** Both are made by wrapping a selection, so each keeps the text typed above as its label. */
		await this.selectParagraph(0);
		await this.insertDocumentLink(options.documentLabel);
		await expect(editor.locator('a[data-target-kind="asset"]')).toHaveText(
			options.documentLinkText,
		);

		await this.selectParagraph(1);
		await this.insertEntityLink(options.entityName);
		await expect(editor.locator('a[data-target-kind="entity"]')).toHaveText(options.entityLinkText);
	}

	/** Build one content block holding a single paragraph that is wholly an entity link. */
	async addContentWithEntityLink(options: { linkText: string; entityName: string }): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();

		await editor.click();
		await editor.pressSequentially(options.linkText);

		await this.selectParagraph(0);
		await this.insertEntityLink(options.entityName);
		await expect(editor.locator('a[data-target-kind="entity"]')).toHaveText(options.linkText);
	}

	/** Build one content block with a paragraph followed by an inline media_text node. */
	async addContentWithMediaText(options: {
		above: string;
		assetLabel: string;
		text: string;
		side?: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.click();
		await editor.pressSequentially(options.above);
		await editor.press("Control+End");
		await editor.press("Enter");

		await this.insertMediaText({
			assetLabel: options.assetLabel,
			text: options.text,
			side: options.side,
		});
	}

	/** Build one content block with a paragraph followed by an inline embed node. */
	async addContentWithEmbed(options: {
		above: string;
		url: string;
		title: string;
		caption: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.click();
		await editor.pressSequentially(options.above);
		await editor.press("Control+End");
		await editor.press("Enter");

		await this.insertEmbed({ url: options.url, title: options.title, caption: options.caption });
	}

	/**
	 * Add a top-level block from the "Add block" menu and return its disclosure panel. These three
	 * types are not inlined into the unified document — they stay as their own collapsible items.
	 */
	private async addBlock(type: string): Promise<Locator> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: type, exact: true }).click();
		await this.waitForMenuToClose();
		const panel = this.page.getByLabel(type, { exact: true }).last();
		await expect(panel).toBeVisible();
		return panel;
	}

	private galleryBlock(): Locator {
		return this.page.getByLabel("Gallery block", { exact: true });
	}

	/**
	 * Insert a gallery node at the cursor and give it one item per caption. Item order is what this
	 * drives: the same asset twice is a legitimate gallery, so the captions are what tell the items
	 * apart, and `moveEarlier` promotes one of them before the list is committed.
	 *
	 * The whole item list is a form committed on Apply, so everything is filled before applying.
	 */
	async insertGallery(options: {
		layout: string;
		assetLabel: string;
		captions: Array<string>;
		/** The gallery's own caption, describing the set rather than any one image. */
		galleryCaption?: string;
		/** 1-based index of the item to move one place earlier, as the panel labels them. */
		moveEarlier?: number;
	}): Promise<void> {
		await this.chooseInsert("Gallery");

		const block = this.galleryBlock();
		await expect(block).toBeVisible();
		await block.getByRole("radio", { name: options.layout, exact: true }).click();

		if (options.galleryCaption != null) {
			await block.getByRole("textbox", { name: "Gallery caption" }).fill(options.galleryCaption);
		}

		/** `renderImagePicker` is the toolbar-shaped picker, so the trigger reads "Insert image". */
		const dialog = this.page.getByRole("dialog", { name: "Media library" });

		for (const [index, caption] of options.captions.entries()) {
			await block.getByRole("button", { name: "Insert image" }).click();
			await dialog.waitFor({ state: "visible" });
			const asset = dialog.getByRole("gridcell", { name: options.assetLabel });
			await expect(asset).toHaveCount(1);
			await asset.click();
			await dialog.getByRole("button", { name: "Select" }).click();
			await dialog.waitFor({ state: "hidden" });

			/* Gallery items follow the shared caption model, so a caption of their own means overriding
			   the asset's. Every item repeats those controls, so they are addressed through the group
			   naming the item rather than by label alone. */
			const position = index + 1;
			await block
				.getByRole("radiogroup", { name: `Caption behavior for image ${String(position)}` })
				.getByRole("radio", { name: "Custom caption", exact: true })
				.click();
			await block
				.getByRole("textbox", { name: `Custom caption for image ${String(position)}` })
				.fill(caption);
		}

		if (options.moveEarlier != null) {
			await block
				.getByRole("button", { name: `Move image ${String(options.moveEarlier)} earlier` })
				.click();
		}

		await block.getByRole("button", { name: "Apply" }).click();
	}

	/** Build one content block with an inline gallery between two paragraphs. */
	async addContentWithGallery(options: {
		above: string;
		below: string;
		layout: string;
		assetLabel: string;
		captions: Array<string>;
		galleryCaption?: string;
		moveEarlier?: number;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.click();
		await editor.pressSequentially(options.above);
		await editor.press("Control+End");
		await editor.press("Enter");

		await this.insertGallery({
			layout: options.layout,
			assetLabel: options.assetLabel,
			captions: options.captions,
			galleryCaption: options.galleryCaption,
			moveEarlier: options.moveEarlier,
		});

		/**
		 * The gallery is an atom at the end of the document, so leaving it needs a gap cursor: put the
		 * caret past the node, then open a paragraph to type the trailing prose into.
		 */
		await editor.press("Control+End");
		await editor.press("Enter");
		await editor.pressSequentially(options.below);
	}

	async addDataBlock(options: { dataType: string; limit: number }): Promise<void> {
		const panel = await this.addBlock("Data");
		await panel.getByRole("button", { name: "Data type" }).click();
		await this.page.getByRole("option", { name: options.dataType, exact: true }).click();
		/**
		 * A textbox, not a spinbutton: the number field is a `type="text"` input carrying
		 * `aria-roledescription="Number field"`. Addressing it by label alone is ambiguous, because the
		 * increment and decrement buttons share its `aria-labelledby`.
		 */
		await panel.getByRole("textbox", { name: "Number of entries" }).fill(String(options.limit));
	}

	async addHeroBlock(options: {
		title: string;
		eyebrow: string;
		assetLabel: string;
		cta: { label: string; url: string };
	}): Promise<void> {
		const panel = await this.addBlock("Hero");
		await panel.getByRole("textbox", { name: "Title" }).fill(options.title);
		await panel.getByRole("textbox", { name: "Eyebrow" }).fill(options.eyebrow);

		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await panel.getByRole("button", { name: /^(Select|Change) image$/ }).click();
		await dialog.waitFor({ state: "visible" });
		const asset = dialog.getByRole("gridcell", { name: options.assetLabel });
		await expect(asset).toHaveCount(1);
		await asset.click();
		await dialog.getByRole("button", { name: "Select" }).click();
		await dialog.waitFor({ state: "hidden" });

		await panel.getByRole("button", { name: "Add CTA" }).click();
		await panel.getByRole("textbox", { name: "Label" }).fill(options.cta.label);
		await panel.getByRole("textbox", { name: "URL" }).fill(options.cta.url);
	}

	/**
	 * An accordion is a node in the unified document now, so it is inserted from inside the editor
	 * rather than chosen from the Add block menu.
	 */
	async addContentWithAccordion(options: {
		intro: string;
		title: string;
		body: string;
	}): Promise<void> {
		await this.page.getByRole("button", { name: "Add block" }).click();
		await this.page.getByRole("menuitem", { name: "Content" }).click();
		await this.waitForMenuToClose();

		const editor = this.contentBlockEditor();
		await editor.fill(options.intro);
		await editor.press("End");
		await this.chooseInsert("Accordion");

		await this.fillInlineAccordion({ title: options.title, body: options.body });
	}

	/**
	 * Drags a container block above the paragraph holding `text`, and waits until it has actually
	 * moved there.
	 *
	 * Grabs the block's `data-drag-handle`, never the block as a whole: a container's body is
	 * editable prose, so making the whole thing the handle would mean a drag starting in the text
	 * moved the block instead of selecting words. Each container puts the handle on its chrome — the
	 * controls corner of a callout, the image column of a `media_text` block.
	 */
	async dragBlockBeforeText(blockLabel: string, text: string): Promise<void> {
		const editor = this.contentBlockEditor();
		const block = this.page.getByLabel(blockLabel, { exact: true });
		const dragHandle = block.locator("[data-drag-handle]").first();
		const targetParagraph = editor.locator("p").filter({ hasText: text });

		/**
		 * The node-view container outside `NodeViewWrapper` carries `draggable`. A node with a content
		 * hole does not get it from ProseMirror — only atoms do — so this asserts the editor put it
		 * there itself; without it the browser fires no `dragstart` and the block cannot be moved at
		 * all.
		 */
		await expect(block.locator("xpath=..")).toHaveAttribute("draggable", "true");
		await block.hover();
		await dragHandle.scrollIntoViewIfNeeded();
		const sourceBox = await dragHandle.boundingBox();
		const targetBox = await targetParagraph.boundingBox();
		if (sourceBox == null || targetBox == null) {
			throw new Error("Could not resolve inline content-block drag coordinates.");
		}

		/** Start in the empty top padding so Chromium does not initiate a text-selection drag. */
		const startX = sourceBox.x + sourceBox.width / 2;
		const startY = sourceBox.y + 6;
		const dropX = targetBox.x + Math.min(24, targetBox.width / 2);
		const dropY = targetBox.y + 2;
		const { mouse } = this.page;
		// Native ProseMirror drag-and-drop needs paced pointer moves to establish a drag selection.
		// oxlint-disable-next-line playwright/no-wait-for-timeout
		const pause = (): Promise<void> => this.page.waitForTimeout(120);

		await mouse.move(startX, startY);
		await mouse.down();
		await pause();
		await mouse.move(startX, startY + 12, { steps: 5 });
		await pause();
		await mouse.move((startX + dropX) / 2, (startY + dropY) / 2, { steps: 10 });
		await pause();
		await mouse.move(dropX, dropY, { steps: 10 });
		await pause();
		await mouse.up();

		await expect
			.poll(async () => {
				const [nextBlockBox, nextTargetBox] = await Promise.all([
					block.boundingBox(),
					targetParagraph.boundingBox(),
				]);
				return nextBlockBox != null && nextTargetBox != null && nextBlockBox.y < nextTargetBox.y;
			})
			.toBe(true);
	}

	async dragCalloutBeforeText(text: string): Promise<void> {
		await this.dragBlockBeforeText("Callout block", text);
	}

	async dragMediaTextBeforeText(text: string): Promise<void> {
		await this.dragBlockBeforeText("Media with text block", text);
	}

	/**
	 * Pointer editing in and around a callout: a caret in the settings panel's title field, and
	 * word-selection in the body.
	 *
	 * The two are reached differently, which is the point. The title is a setting, behind the pencil.
	 * The body is ordinary document content, so double-clicking a word selects it exactly as it would
	 * in the prose outside — there is no panel to open first, and nothing to apply afterwards.
	 */
	async expectCalloutPointerEditing(title: string, selectedWord: string): Promise<void> {
		const callout = this.page.getByLabel("Callout block", { exact: true });

		await callout.getByRole("button", { name: "Edit callout" }).click();
		const titleInput = callout.getByRole("textbox", { name: "Title (optional)" });
		await titleInput.click({ position: { x: 8, y: 12 } });
		const titleSelection = await titleInput.evaluate((element: HTMLInputElement) => {
			return {
				end: element.selectionEnd,
				start: element.selectionStart,
			};
		});
		expect(titleSelection.start).toBe(titleSelection.end);
		expect(titleSelection.start).not.toBeNull();
		expect(titleSelection.start!).toBeLessThan(title.length);
		await callout.getByRole("button", { name: "Cancel" }).click();

		const body = callout.locator("[data-callout-content]");
		await body
			.locator("p")
			.first()
			.dblclick({ position: { x: 28, y: 10 } });
		await expect
			.poll(async () => body.evaluate(() => window.getSelection()?.toString() ?? ""))
			.toBe(selectedWord);
	}

	async updateContentBlockText(text: string): Promise<void> {
		const editor = this.contentBlockEditor();
		await editor.clear();
		await editor.fill(text);
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
		return this.page.getByRole("dialog", { name: /Delete news item/i });
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
			throw new Error("Could not find edit link on news details page.");
		}

		await this.page.goto(editHref);
		await this.page.waitForURL(`**${BASE_PATH}/**/edit`);
		await this.waitForFormHydrated();
	}

	/**
	 * Wait until the form is interactive, not merely painted.
	 *
	 * The richtext editor renders only on the client, so its textbox appearing is the signal that the
	 * page bundle has run. Before that the Save button is inert: the click lands and is swallowed, no
	 * server action is dispatched, and the test fails much later and much less obviously as a missing
	 * action response. Tests that touch the editor before saving happen to wait for this already;
	 * ones that re-save untouched would otherwise race it.
	 *
	 * A news item without content blocks has no editor to wait for, so its absence is not a failure —
	 * only its late arrival is worth waiting on.
	 */
	private async waitForFormHydrated(): Promise<void> {
		await this.contentBlockEditor()
			.first()
			.waitFor({ state: "visible", timeout: 5_000 })
			.catch(() => {
				// No content block on this form; nothing client-only to wait for.
			});
	}

	async gotoEditFromList(title: string): Promise<void> {
		const row = this.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			this.page.waitForURL(`**${BASE_PATH}/**/edit`),
			this.page.getByRole("menuitem", { name: "Edit" }).click(),
		]);
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
		return this.page.getByRole("link", { name: "Draft", exact: true });
	}

	versionSelectorPublishedLink(): Locator {
		return this.page.getByRole("link", { name: "Published" });
	}

	// ---------------------------------------------------------------------------
	// List page — status badge within a row
	// ---------------------------------------------------------------------------

	/** "Published" status badge inside a specific list row. */
	publishedBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Published", { exact: true });
	}

	/** Both "Published" and "Draft" status badges inside a specific list row. */
	publishedAndDraftBadgesInRow(title: string): Locator {
		return this.rowByTitle(title)
			.locator('[data-slot="badge"]')
			.filter({ hasText: /Published|Draft/ });
	}

	/** "Draft" status badge inside a specific list row. */
	draftBadgeInRow(title: string): Locator {
		return this.rowByTitle(title).getByText("Draft", { exact: true });
	}
}
