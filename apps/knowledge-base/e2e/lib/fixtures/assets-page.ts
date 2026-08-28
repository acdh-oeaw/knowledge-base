import type { Locator, Page } from "@playwright/test";

import { fillSearchAndWaitForUrl } from "@/e2e/lib/fixtures/search";

const ASSETS_PATH = "/en/dashboard/website/assets";

/**
 * The media library dialog is not a standalone page — it is embedded in admin forms. We open it
 * from the persons create form, which exposes the image picker trigger.
 */
const MEDIA_LIBRARY_HOST_PATH = "/en/dashboard/administrator/persons/create";

export class AssetsPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// ---------------------------------------------------------------------------
	// Assets list page (`/dashboard/website/assets`)
	// ---------------------------------------------------------------------------

	async goto(): Promise<void> {
		await this.page.goto(ASSETS_PATH);
		await this.page.waitForURL(`**${ASSETS_PATH}`);
	}

	/** Types into the list search field and waits for the `q` URL param to settle. */
	async search(query: string): Promise<void> {
		await fillSearchAndWaitForUrl(this.page, ASSETS_PATH, query);
	}

	assetCardByLabel(label: string): Locator {
		return this.page.getByRole("listitem").filter({ hasText: label });
	}

	async openUploadAssetDialog(): Promise<Locator> {
		await this.goto();
		await this.page.getByRole("button", { name: "Upload asset" }).click();
		const dialog = this.page.getByRole("dialog", { name: "Upload asset" });
		await dialog.waitFor({ state: "visible" });
		return dialog;
	}

	async selectUploadPrefix(dialog: Locator, prefix: string): Promise<void> {
		await dialog.getByRole("button", { name: /Prefix/ }).click();
		await this.page.getByRole("option", { name: prefix, exact: true }).click();
	}

	// ---------------------------------------------------------------------------
	// Media library dialog (embedded in forms, backed by `/api/assets`)
	// ---------------------------------------------------------------------------

	async openMediaLibraryDialog(): Promise<Locator> {
		await this.page.goto(MEDIA_LIBRARY_HOST_PATH);
		await this.page.getByRole("button", { name: /^(Select|Change) image$/ }).click();
		const dialog = this.page.getByRole("dialog", { name: "Media library" });
		await dialog.waitFor({ state: "visible" });
		return dialog;
	}

	/**
	 * Types into the dialog search field and resolves with the `/api/assets` response for the search
	 * request, so callers can assert the request succeeded (the query hits `getMediaLibraryAssets`).
	 */
	async searchInMediaLibrary(dialog: Locator, query: string): ReturnType<Page["waitForResponse"]> {
		const responsePromise = this.page.waitForResponse(
			(response) =>
				response.url().includes("/api/assets") &&
				new URL(response.url()).searchParams.get("q") === query,
		);
		await dialog.getByRole("searchbox").fill(query);
		return responsePromise;
	}

	mediaLibraryAssetByLabel(dialog: Locator, label: string): Locator {
		return dialog.getByRole("gridcell", { name: label });
	}

	// ---------------------------------------------------------------------------
	// Edit asset metadata dialog (opened from a card on the assets list page)
	// ---------------------------------------------------------------------------

	/**
	 * Opens the metadata dialog on the card for `label`, and waits until its license options have
	 * arrived — they are fetched after the dialog opens and grow its content when they replace the
	 * loading placeholder, so measuring before they land measures the wrong layout.
	 */
	async openEditAssetMetadataDialog(label: string): Promise<Locator> {
		await this.goto();
		await this.search(label);

		await this.assetCardByLabel(label)
			.first()
			.getByRole("button", { name: "Edit metadata" })
			.click();

		const dialog = this.page.getByRole("dialog", { name: "Edit asset metadata" });
		await dialog.waitFor({ state: "visible" });
		await dialog.getByRole("progressbar", { name: "Loading..." }).waitFor({ state: "detached" });

		return dialog;
	}
}
