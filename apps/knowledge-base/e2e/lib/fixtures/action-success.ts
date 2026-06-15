import type { Page } from "@playwright/test";

interface WaitForActionSuccessOptions {
	page: Page;
	trigger: () => Promise<unknown>;
}

export async function waitForActionSuccess(
	options: Readonly<WaitForActionSuccessOptions>,
): Promise<void> {
	const { page, trigger } = options;
	const currentPathname = new URL(page.url()).pathname;

	await Promise.all([
		page.waitForResponse((response) => {
			const url = new URL(response.url());
			const redirectTarget = response.headers()["x-action-redirect"];

			return (
				response.request().method() === "POST" &&
				url.pathname === currentPathname &&
				response.status() === 200 &&
				redirectTarget == null
			);
		}),
		trigger(),
	]);
}
