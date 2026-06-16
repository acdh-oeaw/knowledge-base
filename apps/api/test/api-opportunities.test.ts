import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number, sourceId: string) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const title = f.lorem.sentence();
			const slug = slugify(title);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };
			const opportunity = {
				id: versionId,
				title,
				summary: f.lorem.paragraph(),
				duration: { start: f.date.future({ years: 2 }) },
				sourceId,
				website: f.internet.url(),
			};

			return { entity, version, opportunity };
		},
		{ count },
	);

	return items;
}

function createItemWithDuration(duration: { start: Date; end?: Date }, sourceId: string) {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const title = f.lorem.sentence();
	const slug = slugify(title);

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		opportunity: {
			id: versionId,
			title,
			summary: f.lorem.paragraph(),
			duration,
			sourceId,
			website: f.internet.url(),
		},
	};
}

function addDays(date: Date, days: number) {
	const value = new Date(date);
	value.setUTCDate(value.getUTCDate() + days);
	return value;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [status, type] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "opportunities" } }),
	]);

	assert(status, "No entity status in database.");
	assert(type, "No entity type in database.");

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

	await db.insert(schema.opportunities).values(items.map((item) => item.opportunity));

	await Promise.all(items.map((item) => seedContentBlock(db, item.version.id, type.id, "content")));
}

describe("opportunities", () => {
	describe("GET /api/opportunities", () => {
		it("should return paginated list of opportunities", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);
				const source = await db.query.opportunitySources.findFirst({ columns: { id: true } });
				assert(source, "No opportunity source in database.");

				const items = createItems(3, source.id);
				await seed(db, items);

				const item = items.at(1)!;
				const title = item.opportunity.title;
				const website = item.opportunity.website;

				const response = await client.opportunities.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ title, website })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});

		it("should support repeated status and source filters and order the merged result by duration desc", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const sources = await db.query.opportunitySources.findMany({
					columns: { id: true, source: true },
				});
				const dariahSource = sources.find((item) => item.source === "dariah");
				const externalSource = sources.find((item) => item.source === "external");
				assert(dariahSource, 'No opportunity source "dariah" in database.');
				assert(externalSource, 'No opportunity source "external" in database.');
				const now = new Date();

				const upcomingDariah = createItemWithDuration(
					{ start: addDays(now, 365) },
					dariahSource.id,
				);
				const openExternal = createItemWithDuration(
					{ start: addDays(now, -7), end: addDays(now, 7) },
					externalSource.id,
				);
				const closedDariah = createItemWithDuration(
					{ start: addDays(now, -365), end: addDays(now, -7) },
					dariahSource.id,
				);

				await seed(db, [upcomingDariah, openExternal, closedDariah]);

				const response = await client.opportunities.$get({
					query: {
						status: ["upcoming", "open"],
						source: ["dariah", "external"],
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();
				const ids = data.data.map((item) => item.id);

				expect(ids).toContain(upcomingDariah.version.id);
				expect(ids).toContain(openExternal.version.id);
				expect(ids).not.toContain(closedDariah.version.id);
				expect(ids.indexOf(upcomingDariah.version.id)).toBeLessThan(
					ids.indexOf(openExternal.version.id),
				);
			});
		});

		it("should filter by source", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const sources = await db.query.opportunitySources.findMany({
					columns: { id: true, source: true },
				});
				const dariahSource = sources.find((item) => item.source === "dariah");
				const externalSource = sources.find((item) => item.source === "external");
				assert(dariahSource, 'No opportunity source "dariah" in database.');
				assert(externalSource, 'No opportunity source "external" in database.');

				const dariahItem = createItems(1, dariahSource.id).at(0)!;
				const externalItem = createItems(1, externalSource.id).at(0)!;

				await seed(db, [dariahItem, externalItem]);

				const response = await client.opportunities.$get({
					query: {
						source: "dariah",
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();
				const ids = data.data.map((item) => item.id);

				expect(ids).toContain(dariahItem.version.id);
				expect(ids).not.toContain(externalItem.version.id);
			});
		});
	});

	describe("GET /api/opportunities/:id", () => {
		it("should return single opportunity", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const source = await db.query.opportunitySources.findFirst({
					columns: { id: true, source: true },
				});
				assert(source, "No opportunity source in database.");

				const items = createItems(3, source.id);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const title = item.opportunity.title;
				const website = item.opportunity.website;

				const response = await client.opportunities[":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("content" in data);
				expect(data).toMatchObject({
					title,
					website,
					source: {
						id: source.id,
						source: source.source,
					},
				});
				expect(data.content).toHaveLength(1);
				expect(data.content[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.opportunities[":id"].$get({
					param: {
						id: "no-uuid",
					},
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.opportunities[":id"].$get({
					param: {
						id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31",
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/opportunities/slugs", () => {
		it("should return paginated list of opportunity slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);
				const source = await db.query.opportunitySources.findFirst({ columns: { id: true } });
				assert(source, "No opportunity source in database.");

				const items = createItems(3, source.id);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client.opportunities.slugs.$get({
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

	describe("GET /api/opportunities/slugs/:slug", () => {
		it("should return single opportunity", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const source = await db.query.opportunitySources.findFirst({
					columns: { id: true, source: true },
				});
				assert(source, "No opportunity source in database.");

				const items = createItems(3, source.id);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const title = item.opportunity.title;

				const response = await client.opportunities.slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("content" in data);
				expect(data).toMatchObject({
					title,
					source: {
						id: source.id,
						source: source.source,
					},
				});
				expect(data.content).toHaveLength(1);
				expect(data.content[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.opportunities.slugs[":slug"].$get({
					param: {
						slug: "non-existing-slug",
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
