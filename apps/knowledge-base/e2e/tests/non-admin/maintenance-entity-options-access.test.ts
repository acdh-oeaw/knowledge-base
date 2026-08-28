import { expect, test } from "@/e2e/lib/test";

/**
 * Pins the auth boundary on `/api/maintenance/entities`. Unlike `/api/relations/entities`, which is
 * merely authenticated because it only ever returns published documents, this endpoint exposes
 * never-published drafts (titles and slugs of unreleased content) and so must be admin-only.
 *
 * Asserted as an HTTP status rather than rendered content: this is a route handler, so it returns a
 * real 403 instead of rendering the forbidden page.
 */
test.describe("non-admin maintenance entity options", () => {
	test("is forbidden for an authenticated non-admin", async ({ request }) => {
		const response = await request.get("/api/maintenance/entities?limit=1&offset=0");

		expect(response.status()).toBe(403);
	});
});
