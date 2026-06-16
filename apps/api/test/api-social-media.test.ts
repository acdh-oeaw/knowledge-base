import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { SocialMedia } from "@/routes/social-media/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number, typeId: string) {
	const items = f.helpers.multiple(
		() => {
			const id = uuidv7();
			const name = f.internet.displayName();

			const socialMedia = {
				id,
				name,
				url: f.internet.url(),
				duration: {
					start: f.date.past(),
					end: f.date.future(),
				},
				typeId,
			};

			return { socialMedia };
		},
		{ count },
	);

	return items;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [entityStatus, entityType, unitType] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({ columns: { id: true } }),
	]);

	assert(entityStatus, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(unitType, "No organisational unit type in database.");

	await db.insert(schema.socialMedia).values(items.map((item) => item.socialMedia));

	const unitVersionId = uuidv7();
	const unitEntityId = uuidv7();

	await db.insert(schema.entities).values({
		id: unitEntityId,
		slug: `unit-${unitVersionId}`,
		typeId: entityType.id,
	});

	await db.insert(schema.entityVersions).values({
		id: unitVersionId,
		entityId: unitEntityId,
		statusId: entityStatus.id,
	});

	await db.insert(schema.organisationalUnits).values({
		id: unitVersionId,
		name: f.company.name(),
		summary: f.lorem.paragraph(),
		typeId: unitType.id,
	});

	await db.insert(schema.organisationalUnitsToSocialMedia).values(
		items.map((item) => {
			return {
				organisationalUnitId: unitVersionId,
				socialMediaId: item.socialMedia.id,
			};
		}),
	);
}

async function seedType(db: Database) {
	const type = await db.query.socialMediaTypes.findFirst({
		columns: { id: true },
		where: { type: "mastodon" },
	});

	assert(type, "No social media type in database.");

	return type.id;
}

describe("social-media", () => {
	describe("GET /api/social-media", () => {
		it("should return paginated list of social media", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const typeId = await seedType(db);
				const items = createItems(3, typeId);
				await seed(db, items);

				const response = await client["social-media"].$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data.length).toBeGreaterThan(0);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/social-media/:id", () => {
		it("should return single social media entry", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const typeId = await seedType(db);
				const items = createItems(3, typeId);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.socialMedia.id;
				const name = item.socialMedia.name;

				const response = await client["social-media"][":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SocialMedia;

				expect(data).toMatchObject({ name });
				expect(data).toMatchObject({
					duration: {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						start: expect.any(String),
					},
					type: "mastodon",
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					organisationalUnits: expect.arrayContaining([
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
						expect.objectContaining({ name: expect.any(String), type: expect.any(String) }),
					]),
				});
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["social-media"][":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["social-media"][":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
