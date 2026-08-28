import { randomUUID } from "node:crypto";

import type { WebsiteEventsPage } from "@/e2e/lib/fixtures/website-events-page";
import { expect, test } from "@/e2e/lib/test";

/**
 * Focused coverage for the event date/time handling: all-day vs. timed events, switching between
 * them, and — crucially — that the wall-clock a user enters is stored verbatim as UTC with no
 * timezone shift. The whole suite runs under a non-UTC browser timezone so any accidental
 * local-time conversion (e.g. reading `getHours()` instead of `getUTCHours()`, or parsing a picker
 * value without a `Z`) surfaces as a wrong stored instant.
 */
test.describe("website events date & time", () => {
	test.describe.configure({ mode: "default" });

	// Deliberately far from UTC (PDT is −07:00 in June). The stored instants below must NOT shift.
	test.use({ timezoneId: "America/Los_Angeles" });

	test.beforeAll(async ({ db }) => {
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerEvents(testInfo.workerIndex);
	});

	/** Fills the always-required fields and leaves date/time + full-day to the caller. */
	async function startCreate(eventsPage: WebsiteEventsPage, title: string): Promise<void> {
		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(title);
		await eventsPage.fillSummary("E2E date/time event");
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
	}

	test("stores a timed event's start and end as the entered wall-clock in UTC", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Timed ${randomUUID()}`;

		await startCreate(eventsPage, title);
		// Timed event: turn off "Full day" (the default) so the pickers show a time and are labelled
		// "Start"/"End".
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 15, 9, 0);
		await eventsPage.fillDateTimePicker("End", 2025, 6, 15, 17, 0);
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({ isFullDay: false });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T09:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-15T17:00:00.000Z"));
	});

	test("defaults a timed event with no end to its start (bounded, never open-ended)", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Timed no end ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 15, 9, 30);
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({ isFullDay: false });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T09:30:00.000Z"));
		expect(created?.duration.end).toStrictEqual(created?.duration.start);
	});

	test("does not shift the day for times near midnight", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Near midnight ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 16, 0, 30);
		await eventsPage.fillDateTimePicker("End", 2025, 6, 16, 23, 45);
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		// Under a −07:00 browser zone a naive conversion would roll 00:30 back to the 15th / 23:45
		// forward to the 17th. The stored dates must stay on the 16th.
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-16T00:30:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-16T23:45:00.000Z"));
	});

	test("stores an all-day event at UTC midnight through end-of-day", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} All day ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillDatePicker("End date", 2025, 6, 17);
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({ isFullDay: true });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-17T23:59:59.000Z"));
	});

	test("drops the time when switching a timed event to full day", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Timed to full ${randomUUID()}`;

		await startCreate(eventsPage, title);
		// Start timed (turn off the default full-day), then toggle back on: keeps the date, drops the
		// time; the event becomes all-day.
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 15, 13, 30);
		await eventsPage.setFullDay();
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({ isFullDay: true });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-15T23:59:59.000Z"));
	});

	test("keeps the date and lets you set a time when switching full day to timed", async ({
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Full to timed ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		// Toggle off: the date is kept, time defaults to 00:00 and becomes editable.
		await eventsPage.unsetFullDay();
		await eventsPage.fillTime("Start", 14, 15);
		await eventsPage.submitForm();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({ isFullDay: false });
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T14:15:00.000Z"));
		expect(created?.duration.end).toStrictEqual(created?.duration.start);
	});

	test("preserves a timed event's time across an edit that does not touch the dates", async ({
		page,
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Edit keeps time ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 15, 9, 0);
		await eventsPage.fillDateTimePicker("End", 2025, 6, 15, 17, 0);
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		const row = eventsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		// The edit form must load the stored times (read from UTC components, not the browser zone).
		expect(await eventsPage.readTime("Start")).toBe("09:00");
		expect(await eventsPage.readTime("End")).toBe("17:00");

		await eventsPage.fillSummary("Edited summary; times untouched");
		await eventsPage.submitForm();

		const updated = await db.getEventByTitle(title);
		expect(updated?.duration.start).toStrictEqual(new Date("2025-06-15T09:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2025-06-15T17:00:00.000Z"));
	});

	test("preserves an all-day duration across an edit with no date changes", async ({
		page,
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Edit no drift ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillDatePicker("End date", 2025, 6, 17);
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		const row = eventsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await eventsPage.fillSummary("Edited summary; dates untouched");
		await eventsPage.submitForm();

		const updated = await db.getEventByTitle(title);
		// Re-saving must not drift: end-of-day read back as a date and re-normalized is lossless.
		expect(updated?.duration.start).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2025-06-17T23:59:59.000Z"));
	});

	test("rejects an event whose end is before its start", async ({
		page,
		createWebsiteEventsPage,
		db,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} End before start ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 16);
		await eventsPage.fillDatePicker("End date", 2025, 6, 15);

		await page.getByRole("button", { name: /^Save(?! and publish\b).*$/ }).click();

		await expect(page.getByText("The end must be on or after the start.")).toBeVisible();
		await expect(page).toHaveURL(/\/events\/create$/);
		expect(await db.getEventByTitle(title)).toBeNull();
	});

	test("shows the time on the details page for a timed event", async ({
		page,
		createWebsiteEventsPage,
	}) => {
		const eventsPage = createWebsiteEventsPage(test.info().workerIndex);
		const title = `${eventsPage.workerPrefix} Details time ${randomUUID()}`;

		await startCreate(eventsPage, title);
		await eventsPage.unsetFullDay();
		await eventsPage.fillDateTimePicker("Start", 2025, 6, 15, 9, 0);
		await eventsPage.fillDateTimePicker("End", 2025, 6, 15, 17, 0);
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		await eventsPage.gotoDetailsFromList(title);

		// Rendered under the app's global UTC timezone, so it shows 09:00–17:00 even though the
		// browser is in Los Angeles. A timezone leak would show 02:00–10:00.
		await expect(page.getByText(/09:00.*17:00/)).toBeVisible();
	});
});
