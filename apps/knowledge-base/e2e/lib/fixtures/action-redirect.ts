import type { Page } from "@playwright/test";

interface WaitForActionRedirectOptions {
	page: Page;
	redirectPathname: string;
	trigger: () => Promise<unknown>;
}

export async function waitForActionRedirect(
	options: Readonly<WaitForActionRedirectOptions>,
): Promise<void> {
	const { page, redirectPathname, trigger } = options;
	const currentPathname = new URL(page.url()).pathname;

	const [response] = await Promise.all([
		page.waitForResponse((response) => {
			const url = new URL(response.url());
			const redirectTarget = response.headers()["x-action-redirect"]?.split(";")[0];

			if (redirectTarget == null) {
				return false;
			}

			const redirectUrl = new URL(redirectTarget, page.url());

			return (
				response.request().method() === "POST" &&
				url.pathname === currentPathname &&
				response.status() === 303 &&
				redirectUrl.pathname === redirectPathname
			);
		}),
		trigger(),
	]);

	await page
		.waitForURL((url) => url.pathname === redirectPathname, { timeout: 10_000 })
		.catch(async () => {
			const redirectTarget = response.headers()["x-action-redirect"]?.split(";")[0];

			if (redirectTarget == null) {
				throw new Error("Missing server action redirect target.");
			}

			await page.goto(redirectTarget);
			await page.waitForURL((url) => url.pathname === redirectPathname);
		});
}
