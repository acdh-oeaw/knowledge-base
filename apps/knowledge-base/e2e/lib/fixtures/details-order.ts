import { type Page, expect } from "@playwright/test";

export async function expectDetailsTermsInOrder(
	page: Page,
	expectedTerms: Array<string>,
): Promise<void> {
	const terms = await page.locator("dt").allInnerTexts();
	const matchingTerms = terms
		.map((term) => term.trim())
		.filter((term) => expectedTerms.includes(term));

	expect(matchingTerms).toStrictEqual(expectedTerms);
}
