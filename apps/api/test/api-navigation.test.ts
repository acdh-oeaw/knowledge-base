import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

async function seed(db: Database) {
	const menuId = uuidv7();
	const menuName = f.word.noun();

	const parentItemId = uuidv7();
	const parentItemLabel = f.lorem.word();

	const childItemId = uuidv7();
	const childItemLabel = f.lorem.word();

	await db.insert(schema.navigationMenus).values({
		id: menuId,
		name: menuName,
	});

	await db.insert(schema.navigationItems).values([
		{
			id: parentItemId,
			menuId,
			parentId: null,
			label: parentItemLabel,
			href: f.internet.url(),
			position: 0,
		},
		{
			id: childItemId,
			menuId,
			parentId: parentItemId,
			label: childItemLabel,
			href: null,
			position: 0,
		},
	]);

	return { menuId, menuName, parentItemId, parentItemLabel, childItemId, childItemLabel };
}

async function seedWithWorkingGroupEntity(db: Database) {
	const [status, entityType, organisationalUnitType] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "working_group" },
		}),
	]);

	expect(status).toBeDefined();
	expect(entityType).toBeDefined();
	expect(organisationalUnitType).toBeDefined();

	const menuId = uuidv7();
	const itemId = uuidv7();
	const entityId = uuidv7();
	const versionId = uuidv7();
	const menuName = f.word.noun();
	const label = f.lorem.word();
	const slug = `working-group-${uuidv7()}`;

	await db.insert(schema.navigationMenus).values({
		id: menuId,
		name: menuName,
	});

	await db.insert(schema.entities).values({
		id: entityId,
		slug,
		typeId: entityType!.id,
	});

	await db.insert(schema.entityVersions).values({
		id: versionId,
		entityId,
		statusId: status!.id,
	});

	await db.insert(schema.organisationalUnits).values({
		id: versionId,
		name: label,
		typeId: organisationalUnitType!.id,
	});

	await db.insert(schema.navigationItems).values({
		id: itemId,
		menuId,
		parentId: null,
		label,
		href: null,
		entityId,
		position: 0,
	});

	return { menuName, label, slug };
}

describe("navigation", () => {
	describe("GET /api/navigation", () => {
		it("should return all navigation menus with items tree", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { menuName, parentItemLabel, childItemLabel } = await seed(db);

				const response = await client.navigation.$get({ query: {} });

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							name: menuName,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							items: expect.arrayContaining([
								expect.objectContaining({
									label: parentItemLabel,
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									children: expect.arrayContaining([
										expect.objectContaining({ label: childItemLabel }),
									]),
								}),
							]),
						}),
					]),
				);
			});
		});

		it("should filter by menu name", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { menuName, parentItemLabel } = await seed(db);

				const response = await client.navigation.$get({ query: { menu: menuName } });

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data).toHaveLength(1);
				expect(data[0]).toMatchObject({ name: menuName });
				expect(data[0]!.items).toEqual(
					expect.arrayContaining([expect.objectContaining({ label: parentItemLabel })]),
				);
			});
		});

		it("should return organisational unit subtype for entity type", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { menuName, label, slug } = await seedWithWorkingGroupEntity(db);

				const response = await client.navigation.$get({ query: { menu: menuName } });

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data[0]!.items).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							label,
							entity: { type: "working_group", slug },
						}),
					]),
				);
			});
		});

		it("should return empty array for non-existing menu name", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.navigation.$get({ query: { menu: "non-existing-menu" } });

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data).toHaveLength(0);
			});
		});
	});
});
