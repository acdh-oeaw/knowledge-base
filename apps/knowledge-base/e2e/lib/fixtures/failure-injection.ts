import type { Page } from "@playwright/test";

/**
 * Wraps `fn` in a failure-injection scope: the `x-e2e-force-failure` header is attached to all
 * requests made by `page` for the duration of the call, and cleared afterwards. The server-side
 * `createServerAction` wrapper honors this header (gated by the `E2E_FAILURE_INJECTION` env var set
 * by Playwright's webServer config) and short-circuits to an error state.
 *
 * Use this to test the error-handling UX of wrapped actions (e.g. the inline error rendered by the
 * persons delete dialog).
 */
export async function withFailureInjection<T>(page: Page, fn: () => Promise<T>): Promise<T> {
	await page.setExtraHTTPHeaders({ "x-e2e-force-failure": "1" });
	try {
		return await fn();
	} finally {
		await page.setExtraHTTPHeaders({});
	}
}
