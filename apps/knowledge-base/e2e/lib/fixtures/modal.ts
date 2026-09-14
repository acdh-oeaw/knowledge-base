import type { Page } from "@playwright/test";

/**
 * Waits until the open modal has finished its enter animation.
 *
 * Modals scale and fade in over 300ms (`entering:zoom-in-95`), and `boundingBox()` reports the
 * _transformed_ box — so a dialog measured mid-animation comes back a few percent short of its real
 * height, and `toBeInViewport` sees the wrong rectangle. Layout reads (`scrollHeight`,
 * `clientHeight`) are unaffected, which is what makes this flaky rather than consistently wrong:
 * only the tests that measure the painted box notice.
 *
 * React Aria keeps `data-entering` on the modal until the animation ends, so waiting for that
 * attribute to go away is the signal. `state: "detached"` is satisfied when nothing matches the
 * selector any more, which is what removing the attribute does.
 */
export async function waitForModalAnimation(page: Page): Promise<void> {
	await page.locator("[data-slot=modal-content][data-entering]").waitFor({ state: "detached" });
}
