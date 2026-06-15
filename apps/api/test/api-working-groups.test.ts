// oxlint-disable oxc/no-map-spread

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { WorkingGroup } from "@/routes/working-groups/schemas";
import { inArray } from "@/services/db/sql";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

const dariahEuSlug = "dariah-eu";

async function getDariahEu(db: Database) {
	const unit = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: { entityVersion: { entity: { slug: dariahEuSlug } }, type: { type: "eric" } },
		with: { entityVersion: { columns: { entityId: true } } },
	});

	assert(unit, "No DARIAH-EU organisational unit in database.");

	return { documentId: unit.entityVersion.entityId, versionId: unit.id };
}

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const name = f.lorem.sentence();
			const slug = slugify(name);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };

			const organisationalUnit = {
				id: versionId,
				name,
				summary: f.lorem.paragraph(),
			};

			return { entity, version, organisationalUnit };
		},
		{ count },
	);

	return items;
}

function createChair() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const assetId = uuidv7();
	const name = f.person.fullName();
	const slug = slugify(name);
	const affiliationVersionId = uuidv7();
	const affiliationEntityId = uuidv7();
	const affiliationName = f.company.name();

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		asset: {
			id: assetId,
			key: `persons/${assetId}.jpg`,
			label: name,
			mimeType: "image/jpeg",
		},
		person: {
			id: versionId,
			name,
			sortName: f.person.lastName(),
			email: f.internet.email(),
			orcid: `0000-000${String(f.number.int({ min: 1, max: 9 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}`,
			imageId: assetId,
		},
		affiliation: {
			entity: { id: affiliationEntityId, slug: slugify(affiliationName) },
			version: { id: affiliationVersionId, entityId: affiliationEntityId },
			organisationalUnit: {
				id: affiliationVersionId,
				name: affiliationName,
				summary: f.lorem.paragraph(),
			},
		},
	};
}

function createRelatedPage() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const title = f.lorem.sentence();
	const slug = slugify(title);

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		page: { id: versionId, title, summary: f.lorem.paragraph() },
	};
}

async function seedWithMixedStatuses(db: Database) {
	const [status, entityType, asset, workingGroupType, unitStatus] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "working_group" },
		}),
		db
			.select()
			.from(schema.organisationalUnitStatus)
			.where(inArray(schema.organisationalUnitStatus.status, ["is_part_of"])),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(asset, "No assets in database.");
	assert(workingGroupType, "No working_group type in database.");
	assert(unitStatus.length, "No unit status in database.");
	const umbrella = await getDariahEu(db);

	// [0] = unused placeholder, [1][2] = active working groups, [3] = inactive working group
	const items = createItems(4);
	const memberStatusId = unitStatus[0]!.id;
	const pastStart = f.date.past({ years: 5 });

	await db.insert(schema.entities).values(
		items.slice(1).map((item) => {
			return { ...item.entity, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.slice(1).map((item) => {
			return { ...item.version, statusId: status.id };
		}),
	);

	await db.insert(schema.organisationalUnits).values(
		items.slice(1).map((item) => {
			return {
				...item.organisationalUnit,
				typeId: workingGroupType.id,
				imageId: asset.id,
			};
		}),
	);

	// Active: open-ended duration (no end date)
	await db.insert(schema.organisationalUnitsRelations).values(
		items.slice(1, 3).map((item) => {
			return {
				unitDocumentId: item.entity.id,
				relatedUnitDocumentId: umbrella.documentId,
				status: memberStatusId,
				duration: { start: pastStart },
			};
		}),
	);

	// Inactive: end date in the past
	const inactiveEnd = f.date.between({ from: pastStart, to: new Date() });
	await db.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: items[3]!.entity.id,
		relatedUnitDocumentId: umbrella.documentId,
		status: memberStatusId,
		duration: { start: pastStart, end: inactiveEnd },
	});

	return {
		activeItems: items.slice(1, 3),
		inactiveItem: items[3]!,
	};
}

async function seed(db: Database, items: ReturnType<typeof createItems>, chair = createChair()) {
	const umbrella = await getDariahEu(db);
	const [
		status,
		entityType,
		personType,
		organisationalUnitEntityType,
		chairRoleType,
		affiliatedRoleType,
		asset,
		workingGroupType,
		institutionType,
		unitStatus,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "persons" },
		}),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.personRoleTypes.findFirst({
			columns: { id: true },
			where: { type: "is_chair_of" },
		}),
		db.query.personRoleTypes.findFirst({
			columns: { id: true },
			where: { type: "is_affiliated_with" },
		}),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "working_group" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "institution" },
		}),
		db
			.select()
			.from(schema.organisationalUnitStatus)
			.where(inArray(schema.organisationalUnitStatus.status, ["is_part_of"])),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(personType, "No person entity type in database.");
	assert(organisationalUnitEntityType, "No organisational unit entity type in database.");
	assert(chairRoleType, "No chair role type in database.");
	assert(affiliatedRoleType, "No affiliated role type in database.");
	assert(asset, "No assets in database.");
	assert(workingGroupType, "No working_group type in database.");
	assert(institutionType, "No institution type in database.");
	assert(unitStatus.length, "No unit status in database.");

	await db.insert(schema.entities).values(
		items.slice(1).map((item) => {
			return { ...item.entity, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.slice(1).map((item) => {
			return { ...item.version, statusId: status.id };
		}),
	);

	await db.insert(schema.organisationalUnits).values(
		// oxlint-disable-next-line oxc/no-map-spread
		items.slice(1).map((item) => {
			return { ...item.organisationalUnit, typeId: workingGroupType.id, imageId: asset.id };
		}),
	);

	const start = f.date.past({ years: 5 });

	await db.insert(schema.organisationalUnitsRelations).values(
		items.slice(1).map((item) => {
			return {
				unitDocumentId: item.entity.id,
				relatedUnitDocumentId: umbrella.documentId,
				status: f.helpers.arrayElement(unitStatus).id,
				duration: {
					start,
				},
			};
		}),
	);

	await Promise.all(
		items
			.slice(1)
			.map((item) => seedContentBlock(db, item.version.id, entityType.id, "description")),
	);

	await db.insert(schema.assets).values(chair.asset);

	await db.insert(schema.entities).values({
		...chair.entity,
		typeId: personType.id,
	});

	await db.insert(schema.entityVersions).values({
		...chair.version,
		statusId: status.id,
	});

	await db.insert(schema.persons).values(chair.person);

	await db.insert(schema.entities).values({
		...chair.affiliation.entity,
		typeId: organisationalUnitEntityType.id,
	});

	await db.insert(schema.entityVersions).values({
		...chair.affiliation.version,
		statusId: status.id,
	});

	await db.insert(schema.organisationalUnits).values({
		...chair.affiliation.organisationalUnit,
		typeId: institutionType.id,
	});

	await db.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: chair.entity.id,
		organisationalUnitDocumentId: chair.affiliation.entity.id,
		roleTypeId: affiliatedRoleType.id,
		duration: { start },
	});

	await db.insert(schema.personsToOrganisationalUnits).values(
		items.slice(1).map((item) => {
			return {
				personDocumentId: chair.entity.id,
				organisationalUnitDocumentId: item.entity.id,
				roleTypeId: chairRoleType.id,
				duration: { start },
			};
		}),
	);
}

describe("working-groups", () => {
	describe("GET /api/working-groups", () => {
		it("should return paginated list of working groups", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(4);
				await seed(db, items);

				const item = items.at(1)!;
				const name = item.organisationalUnit.name;

				const response = await client["working-groups"].$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length - 1);
				expect(data.data).toEqual(expect.arrayContaining([expect.objectContaining({ name })]));
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	it("should return only active working groups when status=active", async () => {
		await withTransaction(async (db) => {
			const client = createTestClient(db);
			const { activeItems, inactiveItem } = await seedWithMixedStatuses(db);

			const response = await client["working-groups"].$get({
				query: { status: "active" },
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.data).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: activeItems[0]!.organisationalUnit.name }),
				]),
			);
			expect(data.data).not.toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: inactiveItem.organisationalUnit.name }),
				]),
			);
		});
	});

	it("should return only inactive working groups when status=inactive", async () => {
		await withTransaction(async (db) => {
			const client = createTestClient(db);
			const { activeItems, inactiveItem } = await seedWithMixedStatuses(db);

			const response = await client["working-groups"].$get({
				query: { status: "inactive" },
			});

			expect(response.status).toBe(200);
			const data = await response.json();

			expect(data.data).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: inactiveItem.organisationalUnit.name }),
				]),
			);
			expect(data.data).not.toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: activeItems[0]!.organisationalUnit.name }),
				]),
			);
		});
	});

	describe("GET /api/working-groups/:id", () => {
		it("should return single working group", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				const item = items.at(1)!;
				const chair = createChair();
				const relatedPage = createRelatedPage();
				await seed(db, items, chair);
				const [status, pageType, asset] = await Promise.all([
					db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
					db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "pages" } }),
					db.query.assets.findFirst({ columns: { id: true } }),
				]);
				assert(status, "No entity status in database.");
				assert(pageType, "No page entity type in database.");
				assert(asset, "No assets in database.");

				await db.insert(schema.entities).values({
					...relatedPage.entity,
					typeId: pageType.id,
				});
				await db.insert(schema.entityVersions).values({
					...relatedPage.version,
					statusId: status.id,
				});
				await db.insert(schema.pages).values({
					...relatedPage.page,
					imageId: asset.id,
				});
				await db.insert(schema.entitiesToEntities).values({
					entityId: item.entity.id,
					relatedEntityId: relatedPage.entity.id,
				});

				const id = item.organisationalUnit.id;
				const name = item.organisationalUnit.name;

				const response = await client["working-groups"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as WorkingGroup;

				assert("description" in data);
				/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
				expect(data).toMatchObject({
					chairs: expect.arrayContaining([
						expect.objectContaining({
							name: chair.person.name,
							position: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									name: chair.affiliation.organisationalUnit.name,
								}),
								...items.slice(1).map((i) =>
									expect.objectContaining({
										role: "is_chair_of",
										name: i.organisationalUnit.name,
									}),
								),
							]),
						}),
					]),
					name,
					relatedEntities: expect.arrayContaining([
						expect.objectContaining({
							slug: relatedPage.entity.slug,
							entityType: "pages",
							label: relatedPage.page.title,
						}),
					]),
				});
				/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const id = "no-uuid";

				const response = await client["working-groups"][":id"].$get({
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

				const response = await client["working-groups"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/working-groups/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(4);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client["working-groups"].slugs.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length - 1);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ entity: { slug } })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/working-groups/slugs/:slug", () => {
		it("should return single working group", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				const chair = createChair();
				await seed(db, items, chair);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const name = item.organisationalUnit.name;

				const response = await client["working-groups"].slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as WorkingGroup;

				assert("description" in data);
				/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
				expect(data).toMatchObject({
					chairs: expect.arrayContaining([
						expect.objectContaining({
							name: chair.person.name,
							position: expect.arrayContaining([
								expect.objectContaining({
									role: "is_affiliated_with",
									name: chair.affiliation.organisationalUnit.name,
								}),
								...items.slice(1).map((i) =>
									expect.objectContaining({
										role: "is_chair_of",
										name: i.organisationalUnit.name,
									}),
								),
							]),
						}),
					]),
					name,
				});
				/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const slug = "non-existing-slug";

				const response = await client["working-groups"].slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
