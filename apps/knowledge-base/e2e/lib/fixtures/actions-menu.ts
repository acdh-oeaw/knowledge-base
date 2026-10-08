import { type Locator, expect } from "@playwright/test";

/**
 * Opens the first "Open actions menu" dropdown within `scope` (a table row, or a table).
 *
 * A click which lands before the page has hydrated is dropped, so the menu never opens and a test
 * waits on a menu item or navigation which never comes. Re-issue the click until the menu shows,
 * but only while it is closed, so that a menu which is merely slow to render is not toggled shut.
 */
export async function openActionsMenu(scope: Locator): Promise<void> {
	const trigger = scope.getByRole("button", { name: "Open actions menu" }).first();
	const menu = scope.page().getByRole("menu");

	/**
	 * A menu closed just before (e.g. with Escape) stays visible during its exit animation, and would
	 * otherwise be mistaken for the menu being opened here.
	 */
	await expect(menu).toBeHidden();

	await expect(async () => {
		if (!(await menu.isVisible())) {
			await trigger.click();
		}
		await expect(menu).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
}
