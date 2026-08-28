import { expect, test } from "@/e2e/lib/test";

/**
 * Regression guard for the scoped delete in `delete-working-group-report-event.action.ts`. The
 * delete is a plain `<form>` server action whose `eventId` / `workingGroupReportId` are real form
 * fields, so a forged request is reproducible: we override the rendered `eventId` with an event id
 * belonging to _another_ report (one the chair has no access to) while keeping the authorized
 * `workingGroupReportId`.
 *
 * Authorization passes (the chair may update their own report), so a delete scoped by `eventId`
 * alone would remove the foreign row. The fix scopes by both ids, so the foreign event must
 * survive. A legitimate delete is also covered to prove the affordance works.
 */
test.describe("working group report event delete scoping (chair)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let ownReportId: string | null = null;
	let foreignEventId: string | null = null;
	let year: number | null = null;
	let slug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3900 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const ownWorkingGroup = await db.getWorkingGroupOption();
		slug = ownWorkingGroup.slug;
		const ownReport = await db.createWorkingGroupReport({
			campaignId: campaign.id,
			workingGroupDocumentId: ownWorkingGroup.id,
			status: "draft",
		});
		ownReportId = ownReport.id;

		// A report for a different working group — the chair has no relation to it.
		const otherWorkingGroup = await db.getOtherWorkingGroupOption();
		const foreignReport = await db.createWorkingGroupReport({
			campaignId: campaign.id,
			workingGroupDocumentId: otherWorkingGroup.id,
			status: "draft",
		});
		const foreignEvent = await db.createWorkingGroupReportEvent({
			workingGroupReportId: foreignReport.id,
			title: "Foreign WG Event",
		});
		foreignEventId = foreignEvent.id;
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("removes its own event", async ({ page, db }) => {
		const ownEvent = await db.createWorkingGroupReportEvent({
			workingGroupReportId: ownReportId!,
			title: "Own WG Event",
		});

		await page.goto(`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/events`);
		await expect(page.getByText("Own WG Event")).toBeVisible();

		await page.getByRole("button", { name: "Remove" }).click();

		await expect(async () => {
			const row = await db.getWorkingGroupReportEventById(ownEvent.id);
			expect(row).toBeNull();
		}).toPass({ timeout: 10_000 });
	});

	test("cannot delete another report's event via a forged event id", async ({ page, db }) => {
		// Seed an own event so the report renders a delete form to hijack.
		await db.createWorkingGroupReportEvent({
			workingGroupReportId: ownReportId!,
			title: "Decoy WG Event",
		});

		await page.goto(`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/events`);
		await expect(page.getByText("Decoy WG Event")).toBeVisible();

		// Forge the request: point the delete at the foreign report's event while keeping the
		// authorized working-group-report id.
		await page
			.locator('input[name="eventId"]')
			.first()
			.evaluate((element, id) => ((element as HTMLInputElement).value = id), foreignEventId!);

		// Wait for the server action's POST to complete so the delete has actually been attempted.
		const actionResponse = page.waitForResponse(
			(response) => response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Remove" }).click();
		await actionResponse;

		// The scoped delete matched nothing — the foreign event is untouched.
		const foreign = await db.getWorkingGroupReportEventById(foreignEventId!);
		expect(foreign).not.toBeNull();
	});
});
