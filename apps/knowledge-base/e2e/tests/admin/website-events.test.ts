import { randomUUID } from "node:crypto";

import { expectDetailsTermsInOrder } from "@/e2e/lib/fixtures/details-order";
import { expect, test } from "@/e2e/lib/test";

test.describe("website events admin", () => {
	/**
	 * Run sequentially within this file. Suites may run concurrently because test data is isolated by
	 * Playwright worker index.
	 */
	test.describe.configure({ mode: "default" });

	test.beforeAll(async ({ db }) => {
		/** Verify that global prerequisites exist. */
		await db.getTestAsset();
	});

	test.afterAll(async ({ db }, testInfo) => {
		await db.cleanupWorkerEvents(testInfo.workerIndex);
	});

	test("should create an event", async ({ createWebsiteEventsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);

		const title = `${eventsPage.workerPrefix} Test Event ${randomUUID()}`;
		const summary = "E2E test event summary";
		const location = "Vienna, Austria";
		const website = "https://example.com/event";
		const content = `E2E event content ${randomUUID()}`;

		await eventsPage.gotoCreate();

		await eventsPage.fillTitle(title);
		await eventsPage.fillSummary(summary);
		// Toggle "Full day" first: it switches the pickers to date-granularity and relabels them
		// "Start date"/"End date" (timed events default otherwise, labelled "Start"/"End").
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillDatePicker("End date", 2025, 6, 16);
		await eventsPage.fillLocation(location);
		await eventsPage.fillWebsite(website);
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.addContentBlock(content);

		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		await expect(eventsPage.rowByTitle(title)).toBeVisible();

		const created = await db.getEventByTitle(title);
		expect(created).toMatchObject({
			isFullDay: true,
			location,
			summary,
			website,
		});
		expect(created?.imageId).toBeTruthy();
		// All-day events span whole days: start-of-day → end-of-day of the last day.
		expect(created?.duration.start).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(created?.duration.end).toStrictEqual(new Date("2025-06-16T23:59:59.000Z"));
		const contentBlocks = await db.getEventContentBlocksByTitle(title);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(content);

		await eventsPage.gotoDetailsFromList(title);
		await expectDetailsTermsInOrder(eventsPage.page, [
			"Image",
			"Content",
			"Related entities",
			"Related resources",
		]);
	});

	test("should edit all event form fields", async ({ page, createWebsiteEventsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);

		const originalTitle = `${eventsPage.workerPrefix} Edit Me ${randomUUID()}`;
		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(originalTitle);
		await eventsPage.fillSummary("E2E test event to be edited");
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.fillWebsite("https://example.com/old-event");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.addContentBlock("Old event content");
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(originalTitle);
		const row = eventsPage.rowByTitle(originalTitle);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		const updatedTitle = `${eventsPage.workerPrefix} Updated ${randomUUID()}`;
		const updatedSummary = "Updated E2E test event summary";
		const updatedLocation = "Berlin, Germany";
		const updatedWebsite = "https://example.com/updated-event";
		const updatedContent = `Updated E2E event content ${randomUUID()}`;

		await page.getByLabel("Title").fill(updatedTitle);
		await eventsPage.fillSummary(updatedSummary);
		await eventsPage.fillDatePicker("Start date", 2026, 7, 16);
		await eventsPage.fillDatePicker("End date", 2026, 7, 17);
		await eventsPage.fillLocation(updatedLocation);
		await eventsPage.fillWebsite(updatedWebsite);
		await eventsPage.setFullDay();
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.updateContentBlockText(updatedContent);

		await eventsPage.submitForm();

		await eventsPage.searchByTitle(updatedTitle);
		await expect(eventsPage.rowByTitle(updatedTitle)).toBeVisible();
		await eventsPage.searchByTitle(originalTitle);
		await expect(eventsPage.rowByTitle(originalTitle)).toBeHidden();

		const updated = await db.getEventByTitle(updatedTitle);
		expect(updated).toMatchObject({
			isFullDay: true,
			location: updatedLocation,
			summary: updatedSummary,
			website: updatedWebsite,
		});
		expect(updated?.imageId).toBeTruthy();
		expect(updated?.duration.start).toStrictEqual(new Date("2026-07-16T00:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2026-07-17T23:59:59.000Z"));
		const contentBlocks = await db.getEventContentBlocksByTitle(updatedTitle);
		expect(contentBlocks).toHaveLength(1);
		expect(JSON.stringify(contentBlocks[0]!.content)).toContain(updatedContent);
	});

	test("should clear optional event fields", async ({ page, createWebsiteEventsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);
		const title = `${eventsPage.workerPrefix} Clear Optional ${randomUUID()}`;

		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(title);
		await eventsPage.fillSummary("Event with optional fields to clear");
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillDatePicker("End date", 2025, 6, 16);
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.fillWebsite("https://example.com/event-clear");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.addContentBlock("Optional event content");
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		const row = eventsPage.rowByTitle(title);
		await row.getByRole("button", { name: "Open actions menu" }).click();
		await Promise.all([
			page.waitForURL("**/edit"),
			page.getByRole("menuitem", { name: "Edit" }).click(),
		]);

		await eventsPage.fillWebsite("");
		// Clear the end while it is still the date-only picker ("End date"), then turn off "Full day"
		// (which relabels the pickers "Start"/"End" and switches them to time granularity). The
		// cleared end stays cleared through the toggle.
		await eventsPage.clearDatePicker("End date");
		await eventsPage.unsetFullDay();
		await eventsPage.removeFirstContentBlock();
		await eventsPage.submitForm();

		const updated = await db.getEventByTitle(title);
		expect(updated).toMatchObject({ isFullDay: false, website: null });
		// A cleared end collapses to the start — the range is always bounded, never open-ended.
		expect(updated?.duration.start).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(updated?.duration.end).toStrictEqual(new Date("2025-06-15T00:00:00.000Z"));
		expect(await db.getEventContentBlocksByTitle(title)).toHaveLength(0);
	});

	test("should delete an event", async ({ createWebsiteEventsPage, db }) => {
		const workerIndex = test.info().workerIndex;
		const eventsPage = createWebsiteEventsPage(workerIndex);

		const title = `${eventsPage.workerPrefix} Delete Me ${randomUUID()}`;
		await eventsPage.gotoCreate();
		await eventsPage.fillTitle(title);
		await eventsPage.fillSummary("E2E test event to be deleted");
		await eventsPage.setFullDay();
		await eventsPage.fillDatePicker("Start date", 2025, 6, 15);
		await eventsPage.fillLocation("Vienna, Austria");
		await eventsPage.selectImageFromMediaLibrary("E2E Test Asset");
		await eventsPage.submitForm();

		await eventsPage.searchByTitle(title);
		await expect(eventsPage.rowByTitle(title)).toBeVisible();

		const created = await db.getEventByTitle(title);
		expect(created).not.toBeNull();

		const deleteDialog = await eventsPage.openDeleteDialog(title);
		await expect(deleteDialog).toBeVisible();
		await eventsPage.confirmDelete(deleteDialog);

		// The dialog only closes once the server action succeeded; the row alone would also disappear
		// on the optimistic update, so it is not on its own evidence the delete went through.
		await expect(deleteDialog).toBeHidden();
		await expect(eventsPage.rowByTitle(title)).toBeHidden();

		// Source of truth: the entity document and its subtype rows are really gone.
		expect(await db.entityDocumentExists(created!.documentId)).toBe(false);
		expect(await db.getEventByTitle(title)).toBeNull();
	});
});
