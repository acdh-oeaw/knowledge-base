import { waitForActionSuccess } from "@/e2e/lib/fixtures/action-success";
import { expect, test } from "@/e2e/lib/test";

/**
 * Working-group-report content editing as a chair. Covers the Data tab (members save round-trip)
 * and the Questions tab (rich-text answer persisted via the batched upsert action). A question is
 * seeded for the campaign so the questions form renders an answer editor.
 */
test.describe("working group report content (chair)", () => {
	test.describe.configure({ mode: "default" });

	let campaignId: string | null = null;
	let reportId: string | null = null;
	let questionId: string | null = null;
	let year: number | null = null;
	let slug: string | null = null;

	test.beforeAll(async ({ db }) => {
		year = 3750 + test.info().workerIndex;
		const campaign = await db.createOpenCampaign(year);
		campaignId = campaign.id;

		const workingGroup = await db.getWorkingGroupOption();
		slug = workingGroup.slug;
		const report = await db.createWorkingGroupReport({
			campaignId: campaign.id,
			workingGroupDocumentId: workingGroup.id,
			status: "draft",
		});
		reportId = report.id;

		const question = await db.createWorkingGroupReportQuestion({
			campaignId: campaign.id,
			questionText: "What did the working group achieve this year?",
			position: 1,
		});
		questionId = question.id;
	});

	test.afterAll(async ({ db }) => {
		if (campaignId != null) {
			await db.deleteReportingCampaign(campaignId);
		}
	});

	test("saves members", async ({ page }) => {
		await page.goto(`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/data`);

		await page.getByLabel("Number of members").fill("15");
		// Scope to the data form: the screen also renders a comment section with its own "Save". Wait for
		// the (non-redirecting) save action to finish before reloading, otherwise the reload aborts the
		// in-flight POST and nothing is persisted.
		await waitForActionSuccess({
			page,
			trigger: async () => {
				await page
					.locator("form")
					.filter({ has: page.getByLabel("Number of members") })
					.getByRole("button", { name: "Save" })
					.click();
			},
		});

		await expect(page.getByLabel("Number of members")).toHaveValue("15");

		await page.reload();
		await expect(page.getByLabel("Number of members")).toHaveValue("15");
	});

	test("saves a rich-text answer", async ({ page, db }) => {
		await page.goto(
			`/en/dashboard/reporting/working-group-reports/${year!}/${slug!}/edit/questions`,
		);

		// The seeded question is shown (read-only) and offers an answer editor.
		await expect(page.getByText("What did the working group achieve this year?")).toBeVisible();

		const answer = page.getByLabel("Answer to question 1");
		await answer.click();
		await page.keyboard.type("We ran three workshops.");

		// Scope to the questions form: the screen also renders a comment section with its own "Save".
		await page
			.locator("form")
			.filter({ has: answer })
			.getByRole("button", { name: "Save" })
			.click();

		// The batched upsert persists the answer for this report + question.
		await expect(async () => {
			const row = await db.getWorkingGroupReportAnswer(reportId!, questionId!);
			expect(JSON.stringify(row?.answer ?? null)).toContain("We ran three workshops.");
		}).toPass({ timeout: 10_000 });
	});
});
