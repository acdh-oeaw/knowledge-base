import { Readable } from "node:stream";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { StorageService } from "@dariah-eric/storage";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { Result } from "better-result";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createMockStorage(content = "test file content"): StorageService {
	return {
		// eslint-disable-next-line @typescript-eslint/require-await
		async upload() {
			return Result.ok({ key: "" });
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async replace() {
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

async function seedAsset(
	db: Database,
	values: { filename?: string | null; label?: string; mimeType?: string; name?: string },
) {
	const name = values.name ?? uuidv7();
	const key = `documents/${name}`;

	await db.insert(schema.assets).values({
		key,
		label: values.label ?? "Training series flyer",
		filename: values.filename === undefined ? "flyer.pdf" : values.filename,
		mimeType: values.mimeType ?? "application/pdf",
	});

	return { key, name };
}

/** A published news item whose `content` field holds the given rich-text document. */
async function seedNewsItemWithContent(db: Database, content: JSONContent) {
	const [status, type, image, defaultLocale] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "news" } }),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(type, "No entity type in database.");
	assert(image, "No assets in database.");
	assert(defaultLocale, "No default locale in database.");

	const entityId = uuidv7();
	const versionId = uuidv7();
	const title = f.lorem.sentence();

	await db.insert(schema.entities).values({ id: entityId, typeId: type.id });
	await db.insert(schema.entityVersions).values({
		id: versionId,
		entityId,
		statusId: status.id,
		localeId: defaultLocale.id,
	});
	await db.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId,
		typeId: type.id,
		localeId: defaultLocale.id,
		isPublished: true,
		value: slugify(title),
	});
	await db.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: f.date.past(),
		imageId: image.id,
	});

	await seedContentBlock(db, versionId, type.id, "content", content);

	return { id: versionId };
}

/** The marks on the first inline node of the first `rich_text` block in an API response. */
function firstBlockMarks(content: unknown) {
	const blocks = content as Array<{ type: string; content?: JSONContent }>;
	const [block] = blocks;

	expect(block?.type).toBe("rich_text");

	return block!.content!.content![0]!.content![0]!.marks!;
}

describe("assets", () => {
	describe("GET /api/assets/:prefix/:name/download", () => {
		it("should stream the file with its filename and inline disposition for a pdf", async () => {
			await withTransaction(async (db) => {
				const content = "flyer bytes";
				const { name } = await seedAsset(db, {});
				const client = createTestClient(db, createMockStorage(content));

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name },
				});

				expect(response.status).toBe(200);
				expect(response.headers.get("Content-Type")).toBe("application/pdf");
				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="flyer.pdf"; filename*=UTF-8''flyer.pdf`,
				);
				expect(await response.text()).toBe(content);
			});
		});

		it("should serve an image inline, so a linked flyer opens rather than downloads", async () => {
			await withTransaction(async (db) => {
				const { name } = await seedAsset(db, { filename: "flyer.png", mimeType: "image/png" });
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name },
				});

				expect(response.headers.get("Content-Type")).toBe("image/png");
				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="flyer.png"; filename*=UTF-8''flyer.png`,
				);
			});
		});

		it("should serve a non-viewable type as an attachment", async () => {
			await withTransaction(async (db) => {
				const { name } = await seedAsset(db, {
					filename: "posters.zip",
					mimeType: "application/zip",
				});
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name },
				});

				expect(response.status).toBe(200);
				expect(response.headers.get("Content-Type")).toBe("application/zip");
				expect(response.headers.get("Content-Disposition")).toBe(
					`attachment; filename="posters.zip"; filename*=UTF-8''posters.zip`,
				);
			});
		});

		it("should carry a non-ascii filename through the rfc 6266 form", async () => {
			await withTransaction(async (db) => {
				const { name } = await seedAsset(db, { filename: "Persée tour.pdf" });
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name },
				});

				// The plain parameter is stripped to ascii for clients that only read it; the starred one is
				// what carries the real name.
				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="Pers_e tour.pdf"; filename*=UTF-8''Pers%C3%A9e%20tour.pdf`,
				);
			});
		});

		it("should fall back to the slugified label plus an inferred extension", async () => {
			await withTransaction(async (db) => {
				const { name } = await seedAsset(db, {
					filename: null,
					label: "Training Series Flyer",
				});
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name },
				});

				expect(response.headers.get("Content-Disposition")).toBe(
					`inline; filename="training-series-flyer.pdf"; filename*=UTF-8''training-series-flyer.pdf`,
				);
			});
		});

		it("should return 404 for a key no asset claims", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name: uuidv7() },
				});

				expect(response.status).toBe(404);
			});
		});

		it("should return 400 for an unknown storage prefix", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					// The client's param types mirror the prefix picklist, so an unknown prefix has to be
					// forced past them — that the validator rejects it at runtime is the point.
					param: { prefix: "secrets" as unknown as "documents", name: uuidv7() },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 400 for an object name with characters a storage key never has", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db, createMockStorage());

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name: "flyer copy!" },
				});

				expect(response.status).toBe(400);
			});
		});

		// A separator-bearing name never even reaches the validator: the single-segment route does not
		// match it, so it 404s. Asserted anyway, because "cannot address another object" is the
		// property that matters, whichever layer enforces it.
		it("should not serve an object name that tries to escape its prefix", async () => {
			await withTransaction(async (db) => {
				const content = "secret bytes";
				const client = createTestClient(db, createMockStorage(content));

				const response = await client.assets[":prefix"][":name"].download.$get({
					param: { prefix: "documents", name: "../../etc/passwd" },
				});

				expect(response.status).toBe(404);
				expect(await response.text()).not.toBe(content);
			});
		});
	});

	describe("asset-targeted links in content blocks", () => {
		function documentWithLink(attrs: Record<string, unknown>): JSONContent {
			return {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "the flyer", marks: [{ type: "link", attrs }] }],
					},
				],
			};
		}

		it("should resolve the download url, filename and size onto the link", async () => {
			await withTransaction(async (db) => {
				const { key } = await seedAsset(db, { filename: "flyer.pdf" });
				const { id } = await seedNewsItemWithContent(
					db,
					documentWithLink({ href: null, targetKind: "asset", assetKey: key }),
				);

				const response = await createTestClient(db).news[":id"].$get({ param: { id } });
				const data = await response.json();

				assert("content" in data);
				const [mark] = firstBlockMarks(data.content);

				expect(mark).toMatchObject({
					type: "link",
					attrs: {
						assetKey: key,
						// oxlint-disable-next-line typescript/no-unsafe-assignment
						href: expect.stringContaining(`/api/v1/assets/${key}/download`),
						asset: { filename: "flyer.pdf", mimeType: "application/pdf" },
					},
				});
			});
		});

		it("should leave an ordinary link untouched", async () => {
			await withTransaction(async (db) => {
				const { id } = await seedNewsItemWithContent(
					db,
					documentWithLink({ href: "https://example.com/flyer.pdf" }),
				);

				const response = await createTestClient(db).news[":id"].$get({ param: { id } });
				const data = await response.json();

				assert("content" in data);
				const [mark] = firstBlockMarks(data.content);

				expect(mark!.attrs).toEqual({ href: "https://example.com/flyer.pdf" });
			});
		});

		it("should resolve an entity target to its current website url", async () => {
			await withTransaction(async (db) => {
				// The link points at a second news item; the first is only the carrier.
				const target = await seedNewsItemWithContent(db, { type: "doc", content: [] });
				const entity = await db.query.entityVersions.findFirst({
					columns: { entityId: true },
					where: { id: target.id },
				});
				assert(entity, "Seeded version has no entity.");

				const { id } = await seedNewsItemWithContent(
					db,
					documentWithLink({ href: null, targetKind: "entity", entityId: entity.entityId }),
				);

				const response = await createTestClient(db).news[":id"].$get({ param: { id } });
				const data = await response.json();

				assert("content" in data);
				const [mark] = firstBlockMarks(data.content);

				expect(mark!.attrs).toMatchObject({
					targetKind: "entity",
					entityId: entity.entityId,
					// oxlint-disable-next-line typescript/no-unsafe-assignment
					href: expect.stringContaining("/news/"),
					entity: { type: "news" },
				});
			});
		});

		it("should leave an entity target that resolves to nothing without an href", async () => {
			await withTransaction(async (db) => {
				const { id } = await seedNewsItemWithContent(
					db,
					documentWithLink({ href: null, targetKind: "entity", entityId: uuidv7() }),
				);

				const response = await createTestClient(db).news[":id"].$get({ param: { id } });
				const data = await response.json();

				assert("content" in data);
				const [mark] = firstBlockMarks(data.content);

				expect(mark!.attrs!.href).toBeNull();
				expect(mark!.attrs!.entity).toBeUndefined();
			});
		});

		it("should leave a link whose asset has been deleted without an href", async () => {
			await withTransaction(async (db) => {
				const { id } = await seedNewsItemWithContent(
					db,
					documentWithLink({ href: null, targetKind: "asset", assetKey: `documents/${uuidv7()}` }),
				);

				const response = await createTestClient(db).news[":id"].$get({ param: { id } });
				const data = await response.json();

				assert("content" in data);
				const [mark] = firstBlockMarks(data.content);

				expect(mark!.attrs!.href).toBeNull();
				expect(mark!.attrs!.asset).toBeUndefined();
			});
		});
	});
});
