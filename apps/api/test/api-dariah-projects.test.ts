import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { DariahProject } from "@/routes/dariah-projects/schemas";
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

function createProjectData() {
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
		duration: {
			start: f.date.past({ years: 5 }),
		},
	};

	return { entity, version, project };
}

interface SeedResult {
	dariahItems: Array<ReturnType<typeof createProjectData>>;
	nonDariahItem: ReturnType<typeof createProjectData>;
	umbrellaUnitId: string;
	roleId: string;
}

async function seed(db: Database, count: number): Promise<SeedResult> {
	const [status, entityType, scope, unitEntityType, otherType, projectRole] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "projects" } }),
		db.query.projectScopes.findFirst({ columns: { id: true } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "national_consortium" },
		}),
		db.query.projectRoles.findFirst({ where: { role: "participant" }, columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(scope, "No project scope in database.");
	assert(unitEntityType, "No organisational unit entity type in database.");
	assert(otherType, "No consortium type in database.");
	assert(projectRole, "No project role in database.");
	const umbrella = await getDariahEu(db);

	const dariahItems = f.helpers.multiple(() => createProjectData(), { count });
	const nonDariahItem = createProjectData();
	const allItems = [...dariahItems, nonDariahItem];

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

	// Create non-umbrella unit (linked to the non-DARIAH project)
	const otherEntityId = uuidv7();
	const otherUnitId = uuidv7();

	await db.insert(schema.entities).values({
		id: otherEntityId,
		slug: `other-${otherUnitId}`,
		typeId: unitEntityType.id,
	});

	await db.insert(schema.entityVersions).values({
		id: otherUnitId,
		entityId: otherEntityId,
		statusId: status.id,
	});

	await db.insert(schema.organisationalUnits).values({
		id: otherUnitId,
		name: f.company.name(),
		summary: f.lorem.paragraph(),
		typeId: otherType.id,
	});

	// Link DARIAH projects to eric unit
	await db.insert(schema.projectsToOrganisationalUnits).values(
		dariahItems.map((item) => {
			return {
				projectDocumentId: item.entity.id,
				unitDocumentId: umbrella.documentId,
				roleId: projectRole.id,
			};
		}),
	);

	// Link non-DARIAH project to a non-umbrella unit only
	await db.insert(schema.projectsToOrganisationalUnits).values({
		projectDocumentId: nonDariahItem.entity.id,
		unitDocumentId: otherEntityId,
		roleId: projectRole.id,
	});

	await Promise.all(
		allItems.map((item) => seedContentBlock(db, item.version.id, entityType.id, "description")),
	);

	return { dariahItems, nonDariahItem, umbrellaUnitId: umbrella.versionId, roleId: projectRole.id };
}

async function seedWithMixedStatuses(db: Database): Promise<{
	activeItem: ReturnType<typeof createProjectData>;
	inactiveItem: ReturnType<typeof createProjectData>;
}> {
	const [status, entityType, scope, projectRole] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "projects" } }),
		db.query.projectScopes.findFirst({ columns: { id: true } }),
		db.query.projectRoles.findFirst({ where: { role: "participant" }, columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(scope, "No project scope in database.");
	assert(projectRole, "No project role in database.");
	const umbrella = await getDariahEu(db);

	const activeItem = createProjectData();
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

	await db.insert(schema.projectsToOrganisationalUnits).values(
		allItems.map((item) => {
			return {
				projectDocumentId: item.entity.id,
				unitDocumentId: umbrella.documentId,
				roleId: projectRole.id,
			};
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

describe("dariah-projects", () => {
	describe("GET /api/dariah-projects", () => {
		it("should return paginated list of DARIAH projects", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const { dariahItems } = await seed(db, 3);

				const item = dariahItems.at(1)!;
				const name = item.project.name;
				const acronym = item.project.acronym;

				const response = await client["dariah-projects"].$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(dariahItems.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ acronym, name, role: "participant" })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});

		it("should return only active projects when status=active", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { activeItem, inactiveItem } = await seedWithMixedStatuses(db);

				const response = await client["dariah-projects"].$get({
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

				const response = await client["dariah-projects"].$get({
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

		it("should return social media in response", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { dariahItems } = await seed(db, 1);

				const item = dariahItems.at(0)!;
				const id = item.project.id;

				const sm = await seedSocialMedia(db, id);

				const response = await client["dariah-projects"][":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as DariahProject;

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
	});

	describe("GET /api/dariah-projects/:id", () => {
		it("should return single DARIAH project with institutions including roleId", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { dariahItems, roleId: _ } = await seed(db, 3);

				const item = dariahItems.at(1)!;
				const id = item.project.id;
				const name = item.project.name;
				const acronym = item.project.acronym;

				const response = await client["dariah-projects"][":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as DariahProject;

				expect(data).toMatchObject({ acronym, name });
				expect(data.participants).toHaveLength(1);
				expect(data.coordinators).toHaveLength(0);
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for a project not linked to eric", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { nonDariahItem } = await seed(db, 3);

				const response = await client["dariah-projects"][":id"].$get({
					param: { id: nonDariahItem.entity.id },
				});

				expect(response.status).toBe(404);
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["dariah-projects"][":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["dariah-projects"][":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/dariah-projects/slugs", () => {
		it("should return paginated list of DARIAH project slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const { dariahItems } = await seed(db, 3);

				const item = dariahItems.at(1)!;
				const slug = item.entity.slug;

				const response = await client["dariah-projects"].slugs.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(dariahItems.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ entity: { slug } })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/dariah-projects/slugs/:slug", () => {
		it("should return single DARIAH project", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { dariahItems } = await seed(db, 3);

				const item = dariahItems.at(1)!;
				const slug = item.entity.slug;
				const name = item.project.name;

				const response = await client["dariah-projects"].slugs[":slug"].$get({
					param: { slug },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("description" in data);
				expect(data).toMatchObject({ name });
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for a project not linked to eric", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { nonDariahItem } = await seed(db, 3);

				const response = await client["dariah-projects"].slugs[":slug"].$get({
					param: { slug: nonDariahItem.entity.slug },
				});

				expect(response.status).toBe(404);
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["dariah-projects"].slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
