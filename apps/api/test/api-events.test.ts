import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const title = f.lorem.sentence();
			const slug = slugify(title);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };

			const event = {
				id: versionId,
				title,
				summary: f.lorem.paragraph(),
				location: f.location.city(),
				website: f.internet.url(),
				duration: {
					start: f.date.future({ years: 2 }),
				},
			};

			return { entity, version, event };
		},
		{ count },
	);

	return items;
}

function createItemWithDuration(duration: { start: Date; end?: Date }) {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const title = f.lorem.sentence();
	const slug = slugify(title);

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		event: {
			id: versionId,
			title,
			summary: f.lorem.paragraph(),
			location: f.location.city(),
			website: f.internet.url(),
			duration,
		},
	};
}

function expectAdjacentEventLink(actual: unknown, item: ReturnType<typeof createItemWithDuration>) {
	expect(actual).toMatchObject({
		id: item.event.id,
		title: item.event.title,
		location: item.event.location,
		duration: {
			start: item.event.duration.start.toISOString(),
		},
		entity: {
			slug: item.entity.slug,
		},
	});
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [status, type, asset] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "events" } }),
		db.query.assets.findFirst({ columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(type, "No entity type in database.");
	assert(asset, "No assets in database.");

	await db.insert(schema.entities).values(
		items.map((item) => {
			return { ...item.entity, typeId: type.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.map((item) => {
			return { ...item.version, statusId: status.id };
		}),
	);

	await db.insert(schema.events).values(
		items.map((item) => {
			return { ...item.event, imageId: asset.id };
		}),
	);

	await Promise.all(items.map((item) => seedContentBlock(db, item.version.id, type.id, "content")));
}

describe("events", () => {
	describe("GET /api/events", () => {
		it("should return paginated list of events", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const title = item.event.title;

				const response = await client.events.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(expect.arrayContaining([expect.objectContaining({ title })]));
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/events/:id", () => {
		it("should return single event", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const title = item.event.title;
				const website = item.event.website;

				const response = await client.events[":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("content" in data);
				expect(data).toMatchObject({ title, website });
				expect(data.content).toHaveLength(1);
				expect(data.content[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const id = "no-uuid";

				const response = await client.events[":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const id = "019b75fd-6d6a-757c-acc2-c3c6266a0f31";

				const response = await client.events[":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/events/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client.events.slugs.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ entity: { slug } })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/events/slugs/:slug", () => {
		it("should return single event", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const title = item.event.title;
				const website = item.event.website;

				const response = await client.events.slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("content" in data);
				expect(data).toMatchObject({ title, website });
				expect(data.content).toHaveLength(1);
				expect(data.content[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const slug = "non-existing-slug";

				const response = await client.events.slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/events - timeline use case", () => {
		// Simulated anchor date: 2090-03-15 (stands in for "today").
		// Events before the anchor are "past"; events after are "upcoming".
		// Far-future years avoid interference from seed data.

		const anchor = "2090-03-15";
		const dayBeforeAnchor = "2090-03-14";

		function createTimeline() {
			return {
				past1: createItemWithDuration({
					start: new Date("2090-01-01T00:00:00Z"),
					end: new Date("2090-01-10T00:00:00Z"),
				}),
				past2: createItemWithDuration({
					start: new Date("2090-02-01T00:00:00Z"),
					end: new Date("2090-02-10T00:00:00Z"),
				}),
				upcoming1: createItemWithDuration({ start: new Date("2090-04-01T00:00:00Z") }),
				upcoming2: createItemWithDuration({ start: new Date("2090-05-01T00:00:00Z") }),
				upcoming3: createItemWithDuration({ start: new Date("2090-06-01T00:00:00Z") }),
				upcoming4: createItemWithDuration({ start: new Date("2090-07-01T00:00:00Z") }),
			};
		}

		it("initial view: returns upcoming events ordered soonest first", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const t = createTimeline();
				await seed(db, Object.values(t));

				// Use limit=100 to capture our events even if seed data appears ahead of them
				// in asc order. Open-ended seed events satisfy any `from` filter, so we scan
				// the full result set and verify our events appear in the correct relative order.
				const response = await client.events.$get({
					query: { from: anchor, limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				// Default order for from-anchored queries is asc: soonest event first.
				// Verify the entire result set is sorted ascending by start date.
				const starts = data.data.map((e) => e.duration.start);
				expect(starts.every((s, i) => i === 0 || s >= starts[i - 1]!)).toBe(true);

				// Verify our four upcoming events all appear and are in the right relative order.
				const titles = data.data.map((e) => e.title);
				const positions = [t.upcoming1, t.upcoming2, t.upcoming3, t.upcoming4].map((e) =>
					titles.indexOf(e.event.title),
				);

				expect(positions.every((p) => p !== -1)).toBe(true);
				expect(positions[0]).toBeLessThan(positions[1]!);
				expect(positions[1]).toBeLessThan(positions[2]!);
				expect(positions[2]).toBeLessThan(positions[3]!);
			});
		});

		it("forward pagination: pages are non-overlapping and cover the full result set", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const t = createTimeline();
				await seed(db, Object.values(t));

				// Fetch total, then verify that two consecutive pages don't overlap and that
				// paging through the full set eventually surfaces all four upcoming events.
				const allEvents = await client.events.$get({
					query: { from: anchor, limit: "100", offset: "0" },
				});
				const { total } = await allEvents.json();

				const pageSize = Math.ceil(total / 2);

				const [page1Response, page2Response] = await Promise.all([
					client.events.$get({ query: { from: anchor, limit: String(pageSize), offset: "0" } }),
					client.events.$get({
						query: { from: anchor, limit: String(pageSize), offset: String(pageSize) },
					}),
				]);

				const page1 = await page1Response.json();
				const page2 = await page2Response.json();

				// Pages must not overlap.
				const ids1 = new Set(page1.data.map((e) => e.id));
				expect(page2.data.every((e) => !ids1.has(e.id))).toBe(true);

				// All four upcoming events must appear across both pages.
				const allIds = new Set([...page1.data, ...page2.data].map((e) => e.id));
				for (const event of [t.upcoming1, t.upcoming2, t.upcoming3, t.upcoming4]) {
					expect(allIds.has(event.version.id)).toBe(true);
				}
			});
		});

		it("backward navigation from page 1: returns most recent past events newest first", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const t = createTimeline();
				await seed(db, Object.values(t));

				// Switching to until=<day-before-anchor> with default desc order navigates into the past.
				const response = await client.events.$get({
					query: { until: dayBeforeAnchor, limit: "2", offset: "0" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				// Default order for until-only queries is desc: most recent past event first.
				expect(data.data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: t.past1.event.title }),
						expect.objectContaining({ title: t.past2.event.title }),
					]),
				);

				const titles = data.data.map((e) => e.title);
				expect(titles.indexOf(t.past2.event.title)).toBeLessThan(
					titles.indexOf(t.past1.event.title),
				);
			});
		});
	});

	describe("GET /api/events - calendar month use case", () => {
		// Target month: March 2091. Far-future year avoids seed data interference.

		function createCalendarEvents() {
			return {
				// Starts in February, ends in March — must appear in the March view.
				crossMonth: createItemWithDuration({
					start: new Date("2091-02-25T00:00:00Z"),
					end: new Date("2091-03-05T00:00:00Z"),
				}),
				// Fully within March.
				inMarch: createItemWithDuration({
					start: new Date("2091-03-12T00:00:00Z"),
					end: new Date("2091-03-18T00:00:00Z"),
				}),
				// Starts after March — must not appear.
				afterMarch: createItemWithDuration({ start: new Date("2091-04-05T00:00:00Z") }),
				// Ended before March — must not appear.
				beforeMarch: createItemWithDuration({
					start: new Date("2091-01-10T00:00:00Z"),
					end: new Date("2091-02-20T00:00:00Z"),
				}),
			};
		}

		it("returns all events overlapping the month, ordered chronologically", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const c = createCalendarEvents();
				await seed(db, Object.values(c));

				const response = await client.events.$get({
					query: { from: "2091-03-01", until: "2091-03-31", limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: c.crossMonth.event.title }),
						expect.objectContaining({ title: c.inMarch.event.title }),
					]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: c.afterMarch.event.title }),
						expect.objectContaining({ title: c.beforeMarch.event.title }),
					]),
				);

				// Default order for from-anchored queries is asc: cross-month event (Feb 25) before in-March event (Mar 12).
				const titles = data.data.map((e) => e.title);
				expect(titles.indexOf(c.crossMonth.event.title)).toBeLessThan(
					titles.indexOf(c.inMarch.event.title),
				);
			});
		});

		it("cross-month event appears in both the month it starts and the month it ends", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const c = createCalendarEvents();
				await seed(db, Object.values(c));

				const [februaryResponse, marchResponse] = await Promise.all([
					client.events.$get({ query: { from: "2091-02-01", until: "2091-02-28", limit: "100" } }),
					client.events.$get({ query: { from: "2091-03-01", until: "2091-03-31", limit: "100" } }),
				]);

				const february = await februaryResponse.json();
				const march = await marchResponse.json();

				expect(february.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title: c.crossMonth.event.title })]),
				);
				expect(march.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title: c.crossMonth.event.title })]),
				);
			});
		});
	});

	describe("GET /api/events - from/until filters", () => {
		it("from: excludes events that ended before the from date", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const pastEvent = createItemWithDuration({
					start: new Date("2020-01-01T00:00:00Z"),
					end: new Date("2020-01-15T00:00:00Z"),
				});
				const futureEvent = createItemWithDuration({
					start: new Date("2030-06-01T00:00:00Z"),
				});

				await seed(db, [pastEvent, futureEvent]);

				const response = await client.events.$get({
					query: { from: "2025-01-01", limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title: futureEvent.event.title })]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([expect.objectContaining({ title: pastEvent.event.title })]),
				);
			});
		});

		it("from: includes open-ended events regardless of start date", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Open-ended event that started far in the past relative to the `from` date — should
				// still appear because UPPER IS NULL satisfies the overlap condition.
				// Using a far-future `from` date to avoid interference from seed data.
				const oldOpenEndedEvent = createItemWithDuration({
					start: new Date("2090-01-01T00:00:00Z"),
				});

				await seed(db, [oldOpenEndedEvent]);

				const response = await client.events.$get({
					query: { from: "2090-06-01", limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: oldOpenEndedEvent.event.title }),
					]),
				);
			});
		});

		it("until: includes events that start on the until date (full-day inclusive)", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Starts at noon on the until date — should be included even though it's after midnight.
				const noonEvent = createItemWithDuration({
					start: new Date("2024-03-31T12:00:00Z"),
				});
				// Starts the day after — should be excluded.
				const nextDayEvent = createItemWithDuration({
					start: new Date("2024-04-01T00:00:00Z"),
				});

				await seed(db, [noonEvent, nextDayEvent]);

				const response = await client.events.$get({
					query: { until: "2024-03-31" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title: noonEvent.event.title })]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([expect.objectContaining({ title: nextDayEvent.event.title })]),
				);
			});
		});

		it("from+until: includes events that overlap the window (starts before until, ends after from)", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Starts in February, ends in March — must appear in the March calendar view.
				const crossMonthEvent = createItemWithDuration({
					start: new Date("2024-02-28T00:00:00Z"),
					end: new Date("2024-03-05T00:00:00Z"),
				});
				// Fully within March.
				const marchEvent = createItemWithDuration({
					start: new Date("2024-03-10T00:00:00Z"),
					end: new Date("2024-03-15T00:00:00Z"),
				});
				// Entirely before March.
				const januaryEvent = createItemWithDuration({
					start: new Date("2024-01-10T00:00:00Z"),
					end: new Date("2024-01-20T00:00:00Z"),
				});
				// Starts after March.
				const aprilEvent = createItemWithDuration({
					start: new Date("2024-04-05T00:00:00Z"),
				});

				await seed(db, [crossMonthEvent, marchEvent, januaryEvent, aprilEvent]);

				const response = await client.events.$get({
					query: { from: "2024-03-01", until: "2024-03-31", limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: crossMonthEvent.event.title }),
						expect.objectContaining({ title: marchEvent.event.title }),
					]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: januaryEvent.event.title }),
						expect.objectContaining({ title: aprilEvent.event.title }),
					]),
				);
			});
		});

		it("from+until=today: returns ongoing events (overlap semantics)", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const today = new Date();
				const yesterday = new Date(today);
				yesterday.setUTCDate(yesterday.getUTCDate() - 1);
				const tomorrow = new Date(today);
				tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

				// Started yesterday, ends tomorrow — ongoing.
				const ongoingEvent = createItemWithDuration({
					start: yesterday,
					end: tomorrow,
				});
				// Starts tomorrow — not yet started.
				const futureEvent = createItemWithDuration({
					start: tomorrow,
				});
				// Ended yesterday — already over.
				const pastEvent = createItemWithDuration({
					start: new Date("2020-01-01T00:00:00Z"),
					end: yesterday,
				});

				await seed(db, [ongoingEvent, futureEvent, pastEvent]);

				const todayStr = today.toISOString().slice(0, 10);

				const response = await client.events.$get({
					query: { from: todayStr, until: todayStr, limit: "100" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title: ongoingEvent.event.title })]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([
						expect.objectContaining({ title: futureEvent.event.title }),
						expect.objectContaining({ title: pastEvent.event.title }),
					]),
				);
			});
		});

		it("from+until with limit/offset: paginates correctly within the filtered window", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Five events in March 2024, seeded in reverse chronological order so that
				// offset-based paging gives a predictable subset to assert against.
				const marchEvents = [
					createItemWithDuration({ start: new Date("2024-03-25T00:00:00Z") }),
					createItemWithDuration({ start: new Date("2024-03-20T00:00:00Z") }),
					createItemWithDuration({ start: new Date("2024-03-15T00:00:00Z") }),
					createItemWithDuration({ start: new Date("2024-03-10T00:00:00Z") }),
					createItemWithDuration({ start: new Date("2024-03-05T00:00:00Z") }),
				];

				await seed(db, marchEvents);

				const page1 = await client.events.$get({
					query: { from: "2024-03-01", until: "2024-03-31", limit: "3", offset: "0" },
				});

				expect(page1.status).toBe(200);

				const page1Data = await page1.json();

				// Total reflects only the filtered window, not the whole table.
				expect(page1Data.total).toBeGreaterThanOrEqual(marchEvents.length);
				expect(page1Data.data).toHaveLength(3);

				const page2 = await client.events.$get({
					query: { from: "2024-03-01", until: "2024-03-31", limit: "3", offset: "3" },
				});

				expect(page2.status).toBe(200);

				const page2Data = await page2.json();

				expect(page2Data.data.length).toBeGreaterThanOrEqual(2);

				// No overlap between pages.
				const page1Ids = new Set(page1Data.data.map((e) => e.id));
				expect(page2Data.data.every((e) => !page1Ids.has(e.id))).toBe(true);
			});
		});
	});

	describe("GET /api/events/:id - prev/next links", () => {
		it("middle event has both prev and next", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Far-future dates to avoid interference from seed data.
				const early = createItemWithDuration({ start: new Date("2090-01-01T00:00:00Z") });
				const middle = createItemWithDuration({ start: new Date("2091-06-01T00:00:00Z") });
				const late = createItemWithDuration({ start: new Date("2092-12-01T00:00:00Z") });

				await seed(db, [early, middle, late]);

				const response = await client.events[":id"].$get({ param: { id: middle.version.id } });

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("links" in data);
				expectAdjacentEventLink(data.links.prev, early);
				expectAdjacentEventLink(data.links.next, late);
			});
		});

		it("earlier event links forward to later event", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Far-future dates so no seed-data event sits between them.
				const early = createItemWithDuration({ start: new Date("2093-01-01T00:00:00Z") });
				const late = createItemWithDuration({ start: new Date("2093-12-01T00:00:00Z") });

				await seed(db, [early, late]);

				const response = await client.events[":id"].$get({ param: { id: early.version.id } });

				expect(response.status).toBe(200);

				const data = await response.json();

				// `next` must point to `late` — the immediately following event we seeded.
				// We don't assert `prev === null` because the pre-seeded database may contain
				// events with earlier start dates.
				assert("links" in data);
				expectAdjacentEventLink(data.links.next, late);
			});
		});

		it("last event has null next", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// Far-future dates to avoid interference from seed data.
				const early = createItemWithDuration({ start: new Date("2094-01-01T00:00:00Z") });
				const late = createItemWithDuration({ start: new Date("2094-12-01T00:00:00Z") });

				await seed(db, [early, late]);

				const response = await client.events[":id"].$get({ param: { id: late.version.id } });

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("links" in data);
				expectAdjacentEventLink(data.links.prev, early);
				expect(data.links.next).toBeNull();
			});
		});

		it("same-day events: adjacent events are linked in stable (start, id) order", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				// All three start at the exact same timestamp — tests the tuple-cursor logic.
				// Far-future date so no seed-data event sits between them.
				const sameStart = new Date("2095-06-15T00:00:00Z");
				const a = createItemWithDuration({ start: sameStart });
				const b = createItemWithDuration({ start: sameStart });
				const c = createItemWithDuration({ start: sameStart });

				await seed(db, [a, b, c]);

				const responses = await Promise.all([
					client.events[":id"].$get({ param: { id: a.version.id } }),
					client.events[":id"].$get({ param: { id: b.version.id } }),
					client.events[":id"].$get({ param: { id: c.version.id } }),
				]);

				const payloads = await Promise.all(responses.map((r) => r.json()));

				// Sort IDs the same way the (lower, id::text) tuple cursor does,
				// so we can assert that adjacency within the same-timestamp group is correct.
				// eslint-disable-next-line unicorn/no-array-sort
				const [firstId, middleId, lastId] = [a.version.id, b.version.id, c.version.id].sort(
					(x, y) => x.localeCompare(y),
				);

				assert(firstId != null && middleId != null && lastId != null);

				const findPayload = (id: string) => {
					const p = payloads.find((payload) => "id" in payload && payload.id === id);
					assert(p != null && "links" in p);
					return p;
				};

				const first = findPayload(firstId);
				const middle = findPayload(middleId);
				const last = findPayload(lastId);

				// Middle event must link to its two immediate same-timestamp neighbours.
				expectAdjacentEventLink(middle.links.prev, a);
				expectAdjacentEventLink(middle.links.next, c);

				// Last event (highest id) must link back to middle.
				expectAdjacentEventLink(last.links.prev, b);

				// First event (lowest id) must link forward to middle.
				expectAdjacentEventLink(first.links.next, b);

				// No event points to itself.
				for (const payload of payloads) {
					assert("links" in payload);
					expect(payload.links.prev?.id).not.toBe(payload.id);
					expect(payload.links.next?.id).not.toBe(payload.id);
				}
			});
		});
	});
});
