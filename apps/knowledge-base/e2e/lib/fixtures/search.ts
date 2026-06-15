import { type Page, expect } from "@playwright/test";

function matchesSearchUrl(url: URL, pathname: string, query: string): boolean {
	if (url.pathname !== pathname) {
		return false;
	}

	if (query === "") {
		return url.searchParams.get("q") == null;
	}

	return url.searchParams.get("q") === query;
}

export async function fillSearchAndWaitForUrl(
	page: Page,
	pathname: string,
	query: string,
): Promise<void> {
	const nextQuery = query.trim();
	const searchbox = page.getByRole("searchbox");
	const matches = (url: URL) => matchesSearchUrl(url, pathname, nextQuery);

	// Type once and give the resulting navigation time to settle. Under load the search-driven URL
	// update can take a few seconds (Next defers it until the RSC fetch resolves), so we must NOT keep
	// re-typing — that aborts the in-flight navigation before it can land.
	await searchbox.fill(query);
	try {
		await page.waitForURL(matches, { timeout: 10_000 });
		return;
	} catch {
		// The input likely landed before the list page had hydrated, so the change was dropped and no
		// navigation started. Re-issue it (clearing first to force a change event) until it takes.
	}

	await expect(async () => {
		await searchbox.fill("");
		await searchbox.fill(query);
		await page.waitForURL(matches, { timeout: 5_000 });
	}).toPass({ timeout: 20_000 });
}
