import type { Page } from "@playwright/test";

interface WaitForActionRedirectOptions {
	page: Page;
	redirectPathname: string | RegExp;
	trigger: () => Promise<unknown>;
}

function matchesPathname(pathname: string, expected: string | RegExp): boolean {
	return typeof expected === "string" ? pathname === expected : expected.test(pathname);
}

function isSuccessfulRedirectResponse(status: number): boolean {
	return status >= 200 && status < 400;
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
				isSuccessfulRedirectResponse(response.status()) &&
				matchesPathname(redirectUrl.pathname, redirectPathname)
			);
		}),
		trigger(),
	]);

	await page
		.waitForURL((url) => matchesPathname(url.pathname, redirectPathname), { timeout: 10_000 })
		.catch(async () => {
			const redirectTarget = response.headers()["x-action-redirect"]?.split(";")[0];

			if (redirectTarget == null) {
				throw new Error("Missing server action redirect target.");
			}

			await page.goto(redirectTarget);
			await page.waitForURL((url) => matchesPathname(url.pathname, redirectPathname));
		});
}
