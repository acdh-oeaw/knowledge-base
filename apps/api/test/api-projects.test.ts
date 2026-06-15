import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { Project } from "@/routes/projects/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const name = f.lorem.sentence();
			const slug = slugify(name);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };
			const project = {
				id: versionId,
				name,
				acronym: f.string.alpha({ length: { min: 3, max: 8 }, casing: "upper" }),
				summary: f.lorem.paragraph(),
				call: f.lorem.word(),
				topic: f.lorem.word(),
				duration: { start: f.date.past({ years: 5 }) },
			};

			return { entity, version, project };
		},
		{ count },
	);

	return items;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [status, entityType, scope] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "projects" } }),
		db.query.projectScopes.findFirst({ columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(scope, "No project scope in database.");

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

	await db.insert(schema.projects).values(
		items.map((item) => {
			return { ...item.project, scopeId: scope.id };
		}),
	);

	await Promise.all(
		items.map((item) => seedContentBlock(db, item.version.id, entityType.id, "description")),
	);
}

async function seedWithMixedStatuses(db: Database) {
	const [status, entityType, scope] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "projects" } }),
		db.query.projectScopes.findFirst({ columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(scope, "No project scope in database.");

	const activeItem = createItems(1)[0]!;
	const inactiveItem = (() => {
		const versionId = uuidv7();
		const entityId = uuidv7();
		const name = f.lorem.sentence();
		const slug = slugify(name);
		const start = f.date.past({ years: 5 });
		const end = f.date.between({ from: start, to: new Date() });
		return {
			entity: { id: entityId, slug },
			version: { id: versionId, entityId },
			project: {
				id: versionId,
				name,
				acronym: f.string.alpha({ length: { min: 3, max: 8 }, casing: "upper" }),
				summary: f.lorem.paragraph(),
				call: f.lorem.word(),
				topic: f.lorem.word(),
				duration: { start, end },
			},
		};
	})();

	const allItems = [activeItem, inactiveItem];

	await db.insert(schema.entities).values(
		allItems.map((item) => {
			return { ...item.entity, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		allItems.map((item) => {
			return { ...item.version, statusId: status.id };
		}),
	);

	await db.insert(schema.projects).values(
		allItems.map((item) => {
			return { ...item.project, scopeId: scope.id };
		}),
	);

	return { activeItem, inactiveItem };
}

async function seedSocialMedia(db: Database, projectId: string) {
	const type = await db.query.socialMediaTypes.findFirst({
		columns: { id: true },
		where: { type: "mastodon" },
	});

	assert(type, "No social media type in database.");

	const [socialMedia] = await db
		.insert(schema.socialMedia)
		.values({
			name: f.internet.displayName(),
			url: f.internet.url(),
			duration: { start: f.date.past() },
			typeId: type.id,
		})
		.returning({
			id: schema.socialMedia.id,
			url: schema.socialMedia.url,
		});

	assert(socialMedia);

	await db
		.insert(schema.projectsToSocialMedia)
		.values({ projectId, socialMediaId: socialMedia.id });

	return socialMedia;
}

async function seedOrganisationalUnit(
	db: Database,
	projectDocumentId: string,
	roleName: "coordinator" | "participant" | "funder",
) {
	const [status, unitEntityType, unitType, role] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({ columns: { id: true } }),
		db.query.projectRoles.findFirst({
			columns: { id: true },
			where: { role: roleName },
		}),
	]);

	assert(status, "No entity status in database.");
	assert(unitEntityType, "No organisational unit entity type in database.");
	assert(unitType, "No organisational unit type in database.");
	assert(role, "No project role in database.");

	const unitVersionId = uuidv7();
	const unitEntityId = uuidv7();

	await db.insert(schema.entities).values({
		id: unitEntityId,
		slug: `unit-${unitVersionId}`,
		typeId: unitEntityType.id,
	});

	await db.insert(schema.entityVersions).values({
		id: unitVersionId,
		entityId: unitEntityId,
		statusId: status.id,
	});

	const [organisationalUnit] = await db
		.insert(schema.organisationalUnits)
		.values({
			id: unitVersionId,
			name: f.company.name(),
			summary: f.lorem.paragraph(),
			typeId: unitType.id,
		})
		.returning({
			id: schema.organisationalUnits.id,
		});

	assert(organisationalUnit);

	await db.insert(schema.projectsToOrganisationalUnits).values({
		projectDocumentId,
		unitDocumentId: unitEntityId,
		roleId: role.id,
	});

	return organisationalUnit;
}

describe("projects", () => {
	describe("GET /api/projects", () => {
		it("should return paginated list of projects", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const name = item.project.name;
				const acronym = item.project.acronym;

				const response = await client.projects.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ acronym, name })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});

		it("should return social media in response", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(1);
				await seed(db, items);

				const item = items.at(0)!;
				const id = item.version.id;

				const sm = await seedSocialMedia(db, id);

				const response = await client.projects[":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as Project;

				expect(data.socialMedia).toHaveLength(1);
				expect(data.socialMedia).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							url: sm.url,
							type: "mastodon",
						}),
					]),
				);
			});
		});

		it("should return only active projects when status=active", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { activeItem, inactiveItem } = await seedWithMixedStatuses(db);

				const response = await client.projects.$get({
					query: { status: "active" },
				});

				expect(response.status).toBe(200);
				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ name: activeItem.project.name })]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([expect.objectContaining({ name: inactiveItem.project.name })]),
				);
			});
		});

		it("should return only inactive projects when status=inactive", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { activeItem, inactiveItem } = await seedWithMixedStatuses(db);

				const response = await client.projects.$get({
					query: { status: "inactive" },
				});

				expect(response.status).toBe(200);
				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ name: inactiveItem.project.name })]),
				);
				expect(data.data).not.toEqual(
					expect.arrayContaining([expect.objectContaining({ name: activeItem.project.name })]),
				);
			});
		});
	});

	describe("GET /api/projects/:id", () => {
		it("should return single project with partner institutions", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const name = item.project.name;
				const acronym = item.project.acronym;

				await seedOrganisationalUnit(db, item.entity.id, "coordinator");
				await seedOrganisationalUnit(db, item.entity.id, "participant");
				await seedOrganisationalUnit(db, item.entity.id, "funder");

				const response = await client.projects[":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as Project;

				expect(data).toMatchObject({ acronym, name });
				expect(data.partners).toHaveLength(2);
				expect(data.funders).toHaveLength(1);
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.projects[":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.projects[":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/projects/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client.projects.slugs.$get({
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

	describe("GET /api/projects/slugs/:slug", () => {
		it("should return single project", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const name = item.project.name;
				const acronym = item.project.acronym;

				const response = await client.projects.slugs[":slug"].$get({
					param: { slug },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("description" in data);
				expect(data).toMatchObject({ acronym, name });
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.projects.slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
