import { type Locator, expect } from "@playwright/test";

/**
 * Resolves once React has hydrated the element `locator` points at.
 *
 * A click which lands on the server-rendered markup before React has attached its handlers is
 * dropped: a tab stays unselected, a button does nothing, and the test waits on a change which
 * never comes. React marks every host element it has hydrated with an internal `__reactProps$…`
 * key, so wait for that rather than for an arbitrary delay. Unlike re-issuing the click until
 * something changes, this is safe for actions which must only happen once.
 */
export async function waitForHydration(locator: Locator): Promise<void> {
	await expect
		.poll(async () =>
			locator.evaluate((element) =>
				Object.keys(element).some((key) => key.startsWith("__reactProps$")),
			),
		)
		.toBe(true);
}

/** Clicks `locator` once React has hydrated it. */
export async function clickHydrated(locator: Locator): Promise<void> {
	await waitForHydration(locator);
	await locator.click();
}

/**
 * Selects `tab`, re-clicking until it reports `aria-selected="true"`.
 *
 * `waitForHydration` is not enough for a tab on a page still hydrating: React attaches
 * `__reactProps$…` while it renders a hydrating boundary, before that boundary commits. A press
 * that lands then forces React to finish the hydration synchronously and re-creates the tab, so the
 * pointer-up hits a new element and the press is lost. Selecting a tab is idempotent, so retrying
 * is safe — unlike for the once-only actions `clickHydrated` is meant for. Not for tabs whose
 * selection is expected to be cancelled (e.g. by an unsaved-changes guard).
 */
export async function selectTab(tab: Locator): Promise<void> {
	await waitForHydration(tab);
	await expect(async () => {
		if ((await tab.getAttribute("aria-selected")) !== "true") {
			await tab.click();
		}
		await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
}
