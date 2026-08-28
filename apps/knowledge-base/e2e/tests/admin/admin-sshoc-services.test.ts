import { randomUUID } from "node:crypto";

import { expect, test } from "@/e2e/lib/test";

const BASE_PATH = "/en/dashboard/administrator/sshoc-services";
const WORKER_PREFIX = () => `[e2e-worker-${String(test.info().workerIndex)}]`;

test.describe("sshoc services admin", () => {
	test.describe.configure({ mode: "default" });

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerServices(testInfo.workerIndex);
	});

	test("resolves a needs-review service by setting its status", async ({ page, db }) => {
		const suffix = randomUUID();
		const name = `${WORKER_PREFIX()} SSHOC Service ${suffix}`;

		const service = await db.createService({
			name,
			sshocMarketplaceId: `e2e-${suffix}`,
			status: "needs_review",
			type: "community",
		});

		await page.goto(`${BASE_PATH}/${service.id}/edit`);

		// Everything but status stays read-only: the ingest overwrites the rest.
		await expect(page.getByRole("textbox")).toHaveCount(0);

		const control = page
			.locator('[data-slot="control"]')
			.filter({ has: page.getByText("Status", { exact: true }) });
		await control.locator("button").click();
		await page.getByRole("option", { name: "Discontinued", exact: true }).click();

		await page.getByRole("button", { name: "Save" }).click();

		await expect(page.getByText("Service status updated.")).toBeVisible();
		expect(await db.getServiceStatus(service.id)).toBe("discontinued");
	});

	test("does not expose status editing for a service that is not from the marketplace", async ({
		page,
		db,
	}) => {
		const suffix = randomUUID();
		const name = `${WORKER_PREFIX()} Internal Service ${suffix}`;

		const service = await db.createService({ name, status: "live", type: "internal" });

		await page.goto(`${BASE_PATH}/${service.id}/edit`);

		await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
		await expect(page.getByText("Error 404")).toBeVisible();
		await expect(page.getByRole("button", { name: "Save" })).toBeHidden();
		expect(await db.getServiceStatus(service.id)).toBe("live");
	});
});
