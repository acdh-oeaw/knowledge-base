import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { Person } from "@/routes/persons/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const assetId = uuidv7();
			const name = f.person.fullName();
			const slug = slugify(name);
			const affiliationVersionId = uuidv7();
			const affiliationEntityId = uuidv7();
			const affiliationName = f.company.name();
			const affiliationSlug = slugify(affiliationName);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };

			const asset = {
				id: assetId,
				key: `persons/${assetId}.jpg`,
				label: name,
				mimeType: "image/jpeg",
			};

			const person = {
				id: versionId,
				name,
				sortName: f.person.lastName(),
				email: f.internet.email(),
				orcid: `0000-000${String(f.number.int({ min: 1, max: 9 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}`,
				imageId: assetId,
			};

			const affiliation = {
				entity: { id: affiliationEntityId, slug: affiliationSlug },
				version: { id: affiliationVersionId, entityId: affiliationEntityId },
				organisationalUnit: {
					id: affiliationVersionId,
					name: affiliationName,
					summary: f.lorem.paragraph(),
				},
			};

			return { entity, version, asset, person, affiliation };
		},
		{ count },
	);

	return items;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [status, entityType, organisationalUnitType, institutionType, affiliatedRoleType] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "persons" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "institution" },
			}),
			db.query.personRoleTypes.findFirst({
				columns: { id: true },
				where: { type: "is_affiliated_with" },
			}),
		]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(organisationalUnitType, "No organisational unit entity type in database.");
	assert(institutionType, "No institution type in database.");
	assert(affiliatedRoleType, "No affiliated role type in database.");

	await db.insert(schema.assets).values(items.map((item) => item.asset));

	await db.insert(schema.entities).values(
		items.map((item) => {
			return { ...item.entity, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.map((item) => {
			return { ...item.version, statusId: status.id };
		}),
	);

	await db.insert(schema.persons).values(items.map((item) => item.person));

	await db.insert(schema.entities).values(
		items.map((item) => {
			return { ...item.affiliation.entity, typeId: organisationalUnitType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.map((item) => {
			return { ...item.affiliation.version, statusId: status.id };
		}),
	);

	await db.insert(schema.organisationalUnits).values(
		items.map((item) => {
			return { ...item.affiliation.organisationalUnit, typeId: institutionType.id };
		}),
	);

	await db.insert(schema.personsToOrganisationalUnits).values(
		items.map((item) => {
			return {
				personDocumentId: item.entity.id,
				organisationalUnitDocumentId: item.affiliation.entity.id,
				roleTypeId: affiliatedRoleType.id,
				duration: { start: f.date.past({ years: 5 }) },
			};
		}),
	);

	await Promise.all(
		items.map((item) => seedContentBlock(db, item.version.id, entityType.id, "biography")),
	);
}

describe("persons", () => {
	describe("GET /api/persons", () => {
		it("should return paginated list of persons", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const position = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						name: item.affiliation.organisationalUnit.name,
					}),
				]);

				const response = await client.persons.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					expect.arrayContaining([expect.objectContaining({ name, position })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/persons/:id", () => {
		it("should return single person", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const position = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						name: item.affiliation.organisationalUnit.name,
					}),
				]);

				const response = await client.persons[":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as Person;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data).toMatchObject({ name, position });
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data.image).toMatchObject({ url: expect.any(String) });
				expect(data.entity).toMatchObject({ slug: item.entity.slug });
				expect(data.biography).toHaveLength(1);
				expect(data.biography[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons[":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons[":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/persons/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client.persons.slugs.$get({
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

	describe("GET /api/persons/slugs/:slug", () => {
		it("should return single person", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const position = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						name: item.affiliation.organisationalUnit.name,
					}),
				]);

				const response = await client.persons.slugs[":slug"].$get({
					param: { slug },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("biography" in data);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data).toMatchObject({ name, position });
				expect(data.biography).toHaveLength(1);
				expect(data.biography[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons.slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
