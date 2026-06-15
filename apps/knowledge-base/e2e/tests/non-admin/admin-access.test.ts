import { expect, test } from "@/e2e/lib/test";

/**
 * Pins the auth boundary that `assertAdminPageAccess` enforces in
 * `app/(app)/[locale]/(dashboard)/dashboard/administrator/layout.tsx`. A non-admin user landing on
 * any admin route should hit the forbidden page rendered by `app/(app)/[locale]/forbidden.tsx`.
 *
 * We assert on rendered content rather than HTTP status because Next.js's `forbidden()` renders
 * `forbidden.tsx` inside the error boundary without always setting an HTTP 403 status code.
 */
test.describe("non-admin admin access", () => {
	const adminRoutes = [
		"/en/dashboard/administrator",
		"/en/dashboard/administrator/persons",
		"/en/dashboard/administrator/persons/create",
		"/en/dashboard/administrator/users",
	];

	for (const route of adminRoutes) {
		test(`is forbidden at ${route}`, async ({ page }) => {
			await page.goto(route);

			await expect(page.getByText("Error 403")).toBeVisible();
			await expect(page.getByRole("heading", { name: "Access forbidden" })).toBeVisible();

			/** Dashboard chrome (sidebar nav) must not render — confirms the layout's auth gate ran. */
			await expect(page.getByRole("link", { name: "Persons", exact: true })).toBeHidden();
		});
	}

	/** The base dashboard route is accessible to any authenticated user (no admin gate). */
	test("base dashboard route is accessible", async ({ page }) => {
		await page.goto("/en/dashboard");
		await expect(page.getByText("Error 403")).toBeHidden();
	});
});
