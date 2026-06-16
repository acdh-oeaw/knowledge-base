import { Readable } from "node:stream";

import * as schema from "@acdh-knowledge-base/database/schema";
import type { StorageService } from "@acdh-knowledge-base/storage";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { Result } from "better-result";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { eq } from "@/services/db/sql";
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
			const documentOrPolicy = {
				id: versionId,
				title,
				summary: f.lorem.paragraph(),
				url: f.internet.url(),
			};

			return { entity, version, documentOrPolicy };
		},
		{ count },
	);

	return items;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [status, type, asset] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "documents_policies" },
		}),
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

	await db.insert(schema.documentsPolicies).values(
		items.map((item) => {
			return { ...item.documentOrPolicy, documentId: asset.id };
		}),
	);

	await Promise.all(
		items.map((item) => seedContentBlock(db, item.version.id, type.id, "description")),
	);
}

function createMockStorage(content = "test file content"): StorageService {
	return {
		// eslint-disable-next-line @typescript-eslint/require-await
		async upload() {
			return Result.ok({ key: "" });
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async stat() {
			return Result.ok({ size: Buffer.from(content).byteLength });
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async download() {
			return Result.ok(Readable.from([Buffer.from(content)]));
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async delete() {
			throw new Error("Not implemented");
		},
	};
}

describe("documents-policies", () => {
	describe("GET /api/documents-policies", () => {
		it("should return paginated list of documents and policies", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const title = item.documentOrPolicy.title;

				const response = await client["documents-policies"].$get({
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

		it("should order groups and their items before ungrouped items", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const items = createItems(3);
				await seed(db, items);

				const groupId = uuidv7();
				await db.insert(schema.documentPolicyGroups).values({
					id: groupId,
					label: "List ordering group",
					position: -1,
				});

				await Promise.all([
					db
						.update(schema.documentsPolicies)
						.set({ groupId, position: 1 })
						.where(eq(schema.documentsPolicies.id, items[0]!.version.id)),
					db
						.update(schema.documentsPolicies)
						.set({ groupId, position: 0 })
						.where(eq(schema.documentsPolicies.id, items[1]!.version.id)),
					db
						.update(schema.documentsPolicies)
						.set({ position: -100 })
						.where(eq(schema.documentsPolicies.id, items[2]!.version.id)),
				]);

				const response = await client["documents-policies"].$get({
					query: { limit: "100", offset: "0" },
				});
				const { data } = await response.json();
				const relevant = data.filter((item) =>
					items.some((seeded) => seeded.version.id === item.id),
				);

				expect(relevant.map((item) => item.id)).toEqual([
					items[1]!.version.id,
					items[0]!.version.id,
					items[2]!.version.id,
				]);
			});
		});
	});

	describe("GET /api/documents-policies/tree", () => {
		it("should return groups and ungrouped items ordered by position", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const items = createItems(3);
				await seed(db, items);

				const groupId = uuidv7();
				await db.insert(schema.documentPolicyGroups).values({
					id: groupId,
					label: "Test group",
					position: 1,
				});

				await Promise.all([
					db
						.update(schema.documentsPolicies)
						.set({ position: 0 })
						.where(eq(schema.documentsPolicies.id, items[0]!.version.id)),
					db
						.update(schema.documentsPolicies)
						.set({ groupId, position: 1 })
						.where(eq(schema.documentsPolicies.id, items[1]!.version.id)),
					db
						.update(schema.documentsPolicies)
						.set({ groupId, position: 0 })
						.where(eq(schema.documentsPolicies.id, items[2]!.version.id)),
				]);

				const response = await client["documents-policies"].tree.$get();

				expect(response.status).toBe(200);

				const { data } = await response.json();
				const ungroupedIndex = data.findIndex(
					(node) => node.type === "item" && node.id === items[0]!.version.id,
				);
				const groupIndex = data.findIndex((node) => node.type === "group" && node.id === groupId);
				const group = data.at(groupIndex);

				expect(groupIndex).toBeLessThan(ungroupedIndex);
				expect(group).toMatchObject({
					type: "group",
					id: groupId,
					items: [
						{ type: "item", id: items[2]!.version.id },
						{ type: "item", id: items[1]!.version.id },
					],
				});
				expect(data.some((node) => node.type === "item" && node.id === items[1]!.version.id)).toBe(
					false,
				);
			});
		});
	});

	describe("GET /api/documents-policies/:id", () => {
		it("should return single document or policy with document url", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const title = item.documentOrPolicy.title;

				const response = await client["documents-policies"][":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("description" in data);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data).toMatchObject({ title, document: { url: expect.stringContaining(id) } });
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["documents-policies"][":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["documents-policies"][":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/documents-policies/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client["documents-policies"].slugs.$get({
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

	describe("GET /api/documents-policies/slugs/:slug", () => {
		it("should return single document or policy", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const title = item.documentOrPolicy.title;

				const response = await client["documents-policies"].slugs[":slug"].$get({
					param: { slug },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("description" in data);
				expect(data).toMatchObject({ title });
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client["documents-policies"].slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/documents-policies/:id/document", () => {
		async function seedDocument(
			db: Database,
			key: string,
			filename: string | null = "policy-2024.pdf",
			mimeType = "application/pdf",
		) {
			const [status, type] = await Promise.all([
				db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
				db.query.entityTypes.findFirst({
					columns: { id: true },
					where: { type: "documents_policies" },
				}),
			]);

			assert(status, "No entity status in database.");
			assert(type, "No entity type in database.");

			const versionId = uuidv7();
			const entityId = uuidv7();
			const assetId = uuidv7();
			const title = "Test Policy";
			const summary = "Test summary";
			await db.insert(schema.assets).values({ id: assetId, key, label: title, filename, mimeType });
			await db
				.insert(schema.entities)
				.values({ id: entityId, slug: `doc-${versionId}`, typeId: type.id });
			await db
				.insert(schema.entityVersions)
				.values({ id: versionId, entityId, statusId: status.id });
			await db.insert(schema.documentsPolicies).values({
				id: versionId,
				title,
				summary,
				url: "https://example.com",
				documentId: assetId,
			});

			return { id: versionId };
		}

		it("should stream file with correct headers for existing record", async () => {
			await withTransaction(async (db) => {
				const content = "test file content";
				const key = "documents/019b7605-b88f-7893-84af-22aaf476e41f";
				const { id } = await seedDocument(db, key);
				const client = createTestClient(db, createMockStorage(content));

				const response = await client["documents-policies"][":id"].document.$get({
					param: { id },
				});

				expect(response.status).toBe(200);
				expect(response.headers.get("Content-Type")).toBe("application/pdf");
				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="policy-2024.pdf"`,
				);
				const body = await response.text();
				expect(body).toBe(content);
			});
		});

		it("should serve non-PDF documents as attachments with their MIME type", async () => {
			await withTransaction(async (db) => {
				const key = "documents/019b7605-b88f-7893-84af-22aaf476e41f";
				const { id } = await seedDocument(db, key, "policy-2024.docx", "application/msword");
				const client = createTestClient(db, createMockStorage());

				const response = await client["documents-policies"][":id"].document.$get({
					param: { id },
				});

				expect(response.status).toBe(200);
				expect(response.headers.get("Content-Type")).toBe("application/msword");
				expect(response.headers.get("Content-Disposition")).toBe(
					`attachment; filename="policy-2024.docx"`,
				);
			});
		});

		it("should slugify asset label and append inferred extension when original filename is missing", async () => {
			await withTransaction(async (db) => {
				const key = "some/nested/path/019b7605-b88f-7893-84af-22aaf476e41f";
				const { id } = await seedDocument(db, key, null);
				const client = createTestClient(db, createMockStorage());

				const response = await client["documents-policies"][":id"].document.$get({
					param: { id },
				});

				expect(response.status).toBe(200);
				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="test-policy.pdf"`,
				);
			});
		});

		it("should return 404 for valid UUID with no record", async () => {
			await withTransaction(async (db) => {
				const storageCalled = false;
				const storage: StorageService = createMockStorage();
				const client = createTestClient(db, storage);

				const response = await client["documents-policies"][":id"].document.$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
				expect(storageCalled).toBe(false);
			});
		});

		it("should return 400 for non-UUID id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db, createMockStorage());

				const response = await client["documents-policies"][":id"].document.$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});
	});
});
