import { type Page, expect } from "@playwright/test";

export async function createSocialMediaInForm(
	page: Page,
	name: string,
	url: string,
): Promise<void> {
	await page.getByRole("button", { name: "Create social media" }).click();
	const dialog = page.getByRole("dialog", { name: "Create social media" });
	await dialog.getByLabel("Name", { exact: true }).fill(name);
	await dialog.getByLabel("URL").fill(url);
	const typeControl = dialog
		.locator('[data-slot="control"]')
		.filter({ has: page.locator('[data-slot="label"]', { hasText: "Type" }) });
	await typeControl.locator("button[aria-expanded]:not([slot])").click();
	await page.getByRole("option").first().click();
	await dialog.getByRole("button", { name: "Create" }).click();
	await dialog.waitFor({ state: "hidden" });
	await expect(page.getByText(name, { exact: true })).toBeVisible();
}
