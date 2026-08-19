import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

/**
 * The `gallery` block is the only content block whose payload is one-to-many, so it is the only one
 * whose items are fetched separately and stitched back on. These tests pin what can silently break
 * as a result: that items come back in their stored order rather than the database's, that a
 * gallery next to other blocks disturbs neither their order nor their contents, and that the
 * gallery's own caption — read from the block row, not the item query — survives the stitching.
 */

function paragraph(text: string): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

async function seedAsset(
	db: Database,
	label: string,
	caption?: JSONContent,
	dimensions?: { width: number; height: number },
) {
	const id = uuidv7();

	await db.insert(schema.assets).values({
		id,
		key: `images/${uuidv7()}`,
		label,
		caption,
		width: dimensions?.width,
		height: dimensions?.height,
		mimeType: "image/jpeg",
	});

	return id;
}

interface GalleryItemSeed {
	assetId: string;
	caption?: JSONContent;
	captionMode?: (typeof schema.imageCaptionModesEnum)[number];
}

/**
 * A published news item whose `content` field holds the given blocks in order. Blocks are described
 * loosely so a test can put a gallery between rich text without restating the seeding each time.
 */
async function seedNewsItemWithBlocks(
	db: Database,
	blocks: Array<
		| { type: "rich_text"; content: JSONContent }
		| {
				type: "gallery";
				layout?: "carousel" | "grid";
				caption?: JSONContent;
				items: Array<GalleryItemSeed>;
		  }
	>,
) {
	const [status, type, image] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "news" } }),
		db.query.assets.findFirst({ columns: { id: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(type, "No entity type in database.");
	assert(image, "No assets in database.");

	const [blockTypes, fieldName, defaultLocale] = await Promise.all([
		db.query.contentBlockTypes.findMany({ columns: { id: true, type: true } }),
		db.query.entityTypesFieldsNames.findFirst({
			columns: { id: true },
			where: { entityTypeId: type.id, fieldName: "content" },
		}),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(fieldName, "No `content` field name for news in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;
	const blockTypeId = new Map(blockTypes.map((blockType) => [blockType.type, blockType.id]));

	const entityId = uuidv7();
	const versionId = uuidv7();
	const fieldId = uuidv7();
	const title = f.lorem.sentence();
	const slug = slugify(title);

	await db.insert(schema.entities).values({ id: entityId, typeId: type.id });
	await db
		.insert(schema.entityVersions)
		.values({ id: versionId, entityId, statusId: status.id, localeId });
	await db.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId,
		typeId: type.id,
		localeId,
		isPublished: true,
		value: slug,
	});
	await db.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: f.date.past(),
		imageId: image.id,
	});
	await db
		.insert(schema.fields)
		.values({ id: fieldId, entityVersionId: versionId, fieldNameId: fieldName.id });

	for (const [position, block] of blocks.entries()) {
		const blockId = uuidv7();
		const typeId = blockTypeId.get(block.type);
		assert(typeId, `No \`${block.type}\` content block type in database.`);

		await db.insert(schema.contentBlocks).values({ id: blockId, fieldId, typeId, position });

		if (block.type === "rich_text") {
			await db.insert(schema.richTextContentBlocks).values({ id: blockId, content: block.content });
			continue;
		}

		await db
			.insert(schema.galleryContentBlocks)
			.values({ id: blockId, layout: block.layout ?? "grid", caption: block.caption });
		await db.insert(schema.galleryContentBlockItems).values(
			block.items.map((item, itemPosition) => {
				return {
					galleryContentBlockId: blockId,
					imageId: item.assetId,
					position: itemPosition,
					caption: item.caption,
					captionMode: item.captionMode ?? (item.caption != null ? "override" : "inherit"),
				};
			}),
		);
	}

	return { slug };
}

function captionText(caption: unknown): string | undefined {
	const doc = caption as JSONContent | null;
	return doc?.content?.[0]?.content?.[0]?.text;
}

describe("gallery content blocks", () => {
	it("should serialise a gallery with its items in stored order", async () => {
		await withTransaction(async (db) => {
			const first = await seedAsset(db, "first.jpg");
			const second = await seedAsset(db, "second.jpg");
			const third = await seedAsset(db, "third.jpg");

			// Seeded deliberately out of insertion order, so a serialiser that leaned on the database's
			// row order rather than `position` would come back wrong.
			const { slug } = await seedNewsItemWithBlocks(db, [
				{
					type: "gallery",
					items: [
						{ assetId: third, caption: paragraph("third") },
						{ assetId: first, caption: paragraph("first") },
						{ assetId: second, caption: paragraph("second") },
					],
				},
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				content: Array<{ type: string; layout?: string; items?: Array<unknown> }>;
			};
			const [block] = body.content;

			expect(block?.type).toBe("gallery");
			expect(block?.layout).toBe("grid");
			expect(block?.items).toHaveLength(3);
			expect(
				block!.items!.map((item) => captionText((item as { caption: unknown }).caption)),
			).toStrictEqual(["third", "first", "second"]);
		});
	});

	it("should keep a gallery in place among the blocks around it", async () => {
		await withTransaction(async (db) => {
			const assetId = await seedAsset(db, "only.jpg");

			const { slug } = await seedNewsItemWithBlocks(db, [
				{ type: "rich_text", content: paragraph("before") },
				{ type: "gallery", layout: "carousel", items: [{ assetId }] },
				{ type: "rich_text", content: paragraph("after") },
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				content: Array<{ type: string; layout?: string; content?: unknown }>;
			};

			expect(body.content.map((block) => block.type)).toStrictEqual([
				"rich_text",
				"gallery",
				"rich_text",
			]);
			expect(captionText(body.content[0]?.content)).toBe("before");
			expect(captionText(body.content[2]?.content)).toBe("after");
			expect(body.content[1]?.layout).toBe("carousel");
		});
	});

	it("should take an item's caption from its asset when the item does not override it", async () => {
		await withTransaction(async (db) => {
			const inherited = await seedAsset(db, "inherited.jpg", paragraph("from the asset"));
			const overridden = await seedAsset(db, "overridden.jpg", paragraph("from the asset"));

			const { slug } = await seedNewsItemWithBlocks(db, [
				{
					type: "gallery",
					items: [
						{ assetId: inherited, captionMode: "inherit" },
						{ assetId: overridden, caption: paragraph("from the item") },
					],
				},
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				content: Array<{ items?: Array<{ caption: unknown; captionSource: string | null }> }>;
			};
			const items = body.content[0]?.items;

			assert(items);
			expect(items.map((item) => captionText(item.caption))).toStrictEqual([
				"from the asset",
				"from the item",
			]);
			expect(items.map((item) => item.captionSource)).toStrictEqual(["asset", "block"]);
		});
	});

	/**
	 * Every image in the api is serialized through one schema, and these blocks used to spell theirs
	 * out instead. Responses are parsed before they are sent, so a field the block schema does not
	 * declare is stripped rather than reported — which is how `srcUrl`, `width` and `height` reached
	 * every other image and none of the ones on a block. Asserted on the gallery because all four
	 * block schemas now share the one image schema.
	 */
	it("should carry the variant endpoint url and the source dimensions on an item's image", async () => {
		await withTransaction(async (db) => {
			const assetId = await seedAsset(db, "wide.jpg", undefined, { width: 1600, height: 900 });

			const { slug } = await seedNewsItemWithBlocks(db, [
				{ type: "gallery", items: [{ assetId }] },
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				content: Array<{
					items?: Array<{
						image: { srcUrl?: string; width?: number | null; height?: number | null };
					}>;
				}>;
			};
			const image = body.content[0]?.items?.[0]?.image;

			assert(image);
			// The base url a consumer appends `?w=`/`&ar=` to, and the ceiling it must not ask above.
			expect(image.srcUrl).toContain("/image/v1");
			expect(image.width).toBe(1600);
			expect(image.height).toBe(900);
		});
	});

	it("should serve the gallery's own caption beside its items'", async () => {
		await withTransaction(async (db) => {
			const assetId = await seedAsset(db, "only.jpg");

			const { slug } = await seedNewsItemWithBlocks(db, [
				{
					type: "gallery",
					caption: paragraph("what the set shows"),
					items: [{ assetId, caption: paragraph("what this image shows") }],
				},
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as {
				content: Array<{ caption?: unknown; items?: Array<{ caption: unknown }> }>;
			};
			const [block] = body.content;

			// The two are distinct: one describes the gallery, the other credits an image in it.
			expect(captionText(block?.caption)).toBe("what the set shows");
			expect(block?.items?.map((item) => captionText(item.caption))).toStrictEqual([
				"what this image shows",
			]);
		});
	});

	it("should serve a null caption for a gallery that has none", async () => {
		await withTransaction(async (db) => {
			const assetId = await seedAsset(db, "only.jpg");

			const { slug } = await seedNewsItemWithBlocks(db, [
				{ type: "gallery", items: [{ assetId }] },
			]);

			const client = createTestClient(db);
			const response = await client.news.slugs[":slug"].$get({ param: { slug }, query: {} });

			expect(response.status).toBe(200);

			const body = (await response.json()) as { content: Array<{ caption?: unknown }> };

			expect(body.content[0]?.caption).toBeNull();
		});
	});
});
