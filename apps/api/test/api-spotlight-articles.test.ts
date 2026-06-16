import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { SpotlightArticle } from "@/routes/spotlight-articles/schemas";
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

			const spotlightArticle = {
				id: versionId,
				title,
				summary: f.lorem.paragraph(),
			};

			return { entity, version, spotlightArticle };
		},
		{ count },
	);

	return items;
}

function createContributor() {
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

async function seed(
	db: Database,
	items: ReturnType<typeof createItems>,
	contributor = createContributor(),
) {
	const [
		status,
		type,
		personType,
		organisationalUnitType,
		institutionType,
		affiliatedRoleType,
		asset,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "spotlight_articles" },
		}),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "persons" },
		}),
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
		db.query.assets.findFirst({ columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(type, "No entity type in database.");
	assert(personType, "No person entity type in database.");
	assert(organisationalUnitType, "No organisational unit entity type in database.");
	assert(institutionType, "No institution type in database.");
	assert(affiliatedRoleType, "No affiliated role type in database.");
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

	await db.insert(schema.spotlightArticles).values(
		items.map((item) => {
			return { ...item.spotlightArticle, imageId: asset.id };
		}),
	);

	await Promise.all(items.map((item) => seedContentBlock(db, item.version.id, type.id, "content")));

	await db.insert(schema.assets).values(contributor.asset);

	await db.insert(schema.entities).values({
		...contributor.entity,
		typeId: personType.id,
	});

	await db.insert(schema.entityVersions).values({
		...contributor.version,
		statusId: status.id,
	});

	await db.insert(schema.persons).values(contributor.person);

	await db.insert(schema.entities).values({
		...contributor.affiliation.entity,
		typeId: organisationalUnitType.id,
	});

	await db.insert(schema.entityVersions).values({
		...contributor.affiliation.version,
		statusId: status.id,
	});

	await db.insert(schema.organisationalUnits).values({
		...contributor.affiliation.organisationalUnit,
		typeId: institutionType.id,
	});

	await db.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: contributor.entity.id,
		organisationalUnitDocumentId: contributor.affiliation.entity.id,
		roleTypeId: affiliatedRoleType.id,
		duration: { start: f.date.past({ years: 5 }) },
	});

	// Contributors are document-level; key both endpoints to their document ids.
	await db.insert(schema.spotlightArticlesToPersons).values(
		items.map((item) => {
			return {
				spotlightArticleDocumentId: item.entity.id,
				personDocumentId: contributor.entity.id,
			};
		}),
	);
}

describe("spotlight-articles", () => {
	describe("GET /api/spotlight-articles", () => {
		it("should return paginated list of spotlight articles", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const title = item.spotlightArticle.title;

				const response = await client["spotlight-articles"].$get({
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

	describe("GET /api/spotlight-articles/:id", () => {
		it("should return single spotlight article", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				const contributor = createContributor();
				await seed(db, items, contributor);

				const item = items.at(1)!;
				const id = item.spotlightArticle.id;
				const title = item.spotlightArticle.title;
				const contributorName = contributor.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const contributorPosition = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						name: contributor.affiliation.organisationalUnit.name,
					}),
				]);

				const response = await client["spotlight-articles"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SpotlightArticle;

				assert("content" in data);
				expect(data).toMatchObject({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					contributors: expect.arrayContaining([
						expect.objectContaining({
							name: contributorName,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							position: contributorPosition,
						}),
					]),
					title,
				});
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

				const response = await client["spotlight-articles"][":id"].$get({
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

				const response = await client["spotlight-articles"][":id"].$get({
					param: {
						id,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/spotlight-articles/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client["spotlight-articles"].slugs.$get({
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

	describe("GET /api/spotlight-articles/slugs/:slug", () => {
		it("should return single spotlight article", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				const contributor = createContributor();
				await seed(db, items, contributor);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const title = item.spotlightArticle.title;
				const contributorName = contributor.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const contributorPosition = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						name: contributor.affiliation.organisationalUnit.name,
					}),
				]);

				const response = await client["spotlight-articles"].slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SpotlightArticle;

				assert("content" in data);
				expect(data).toMatchObject({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					contributors: expect.arrayContaining([
						expect.objectContaining({
							name: contributorName,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							position: contributorPosition,
						}),
					]),
					title,
				});
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

				const response = await client["spotlight-articles"].slugs[":slug"].$get({
					param: {
						slug,
					},
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
