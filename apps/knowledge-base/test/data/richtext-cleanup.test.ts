import { assert } from "@acdh-oeaw/lib";
import {
	cleanRichText,
	findRichTextNeedingCleanup,
} from "@dariah-eric/database/richtext-cleanup-service";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createDraftDocument } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

/**
 * Richtext does not live in one place: a block keeps its prose in a table of its own, and a caption
 * is a second document beside it — on the block's row and, for a gallery, on a row per item. These
 * assertions are what keeps every one of those reachable, because a caption the service cannot see
 * is a caption that keeps the oddities everything else had cleaned away.
 *
 * Against the database rather than a fixture: what is being tested is the reach of the query, and a
 * stubbed one would agree with whatever the code does.
 */

/** A document with a spacer paragraph and a trailing space — normalising rewrites both. */
function untidy(text: string): JSONContent {
	return {
		type: "doc",
		content: [
			{ type: "paragraph" },
			{ type: "paragraph", content: [{ type: "text", text: `${text} ` }] },
		],
	};
}

function tidy(text: string): JSONContent {
	return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

async function getAsset(tx: Transaction) {
	const asset = await tx.query.assets.findFirst({ columns: { id: true } });
	assert(asset, "No asset found in database — seed one first.");
	return asset;
}

/** A draft news version with one field to hang content blocks off. */
async function seedField(tx: Transaction): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(entityType, "news entity type not found in database");

	const title = f.lorem.sentence();
	const { versionId } = await createDraftDocument(tx, entityType.id, slugify(title));
	const asset = await getAsset(tx);

	await tx.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: new Date("2025-01-15T00:00:00.000Z"),
		imageId: asset.id,
	});

	const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
		where: { entityTypeId: entityType.id, fieldName: "content" },
		columns: { id: true },
	});
	assert(fieldName);

	const [field] = await tx
		.insert(schema.fields)
		.values({ entityVersionId: versionId, fieldNameId: fieldName.id })
		.returning({ id: schema.fields.id });
	assert(field);

	return field.id;
}

async function addBlock(
	tx: Transaction,
	fieldId: string,
	type: schema.ContentBlockTypes["type"],
	position: number,
	parentBlockId: string | null = null,
): Promise<string> {
	const blockType = await tx.query.contentBlockTypes.findFirst({
		where: { type },
		columns: { id: true },
	});
	assert(blockType, `${type} content block type not found in database`);

	const [block] = await tx
		.insert(schema.contentBlocks)
		.values({ fieldId, typeId: blockType.id, position, parentBlockId })
		.returning({ id: schema.contentBlocks.id });
	assert(block);

	return block.id;
}

describe("richtext cleanup", () => {
	it("finds untidy richtext in every kind of block that holds it", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const asset = await getAsset(tx);

			const richTextId = await addBlock(tx, fieldId, "rich_text", 0);
			await tx
				.insert(schema.richTextContentBlocks)
				.values({ id: richTextId, content: untidy("Prose") });

			// A callout's body is a `rich_text` child, so untidy prose inside one is reported as the
			// nested block it is stored as — not as the callout.
			const calloutId = await addBlock(tx, fieldId, "callout", 1);
			await tx.insert(schema.calloutContentBlocks).values({ id: calloutId, intent: "info" });
			const calloutBodyId = await addBlock(tx, fieldId, "rich_text", 0, calloutId);
			await tx
				.insert(schema.richTextContentBlocks)
				.values({ id: calloutBodyId, content: untidy("Callout") });

			const imageId = await addBlock(tx, fieldId, "image", 2);
			await tx
				.insert(schema.imageContentBlocks)
				.values({ id: imageId, imageId: asset.id, caption: untidy("Image caption") });

			const embedId = await addBlock(tx, fieldId, "embed", 3);
			await tx.insert(schema.embedContentBlocks).values({
				id: embedId,
				url: "https://example.com/video",
				title: "A video",
				caption: untidy("Embed caption"),
			});

			const mediaTextId = await addBlock(tx, fieldId, "media_text", 4);
			await tx.insert(schema.mediaTextContentBlocks).values({
				id: mediaTextId,
				imageId: asset.id,
				content: untidy("Media prose"),
				caption: untidy("Media caption"),
			});

			const heroId = await addBlock(tx, fieldId, "hero", 5);
			await tx
				.insert(schema.heroContentBlocks)
				.values({ id: heroId, title: "A hero", caption: untidy("Hero caption") });

			const galleryId = await addBlock(tx, fieldId, "gallery", 6);
			await tx.insert(schema.galleryContentBlocks).values({ id: galleryId, layout: "grid" });
			await tx.insert(schema.galleryContentBlockItems).values({
				galleryContentBlockId: galleryId,
				imageId: asset.id,
				position: 0,
				caption: untidy("Gallery caption"),
			});

			// Two levels down, and found the same way: an accordion holds panels, a panel holds blocks.
			const accordionId = await addBlock(tx, fieldId, "accordion", 7);
			await tx.insert(schema.accordionContentBlocks).values({ id: accordionId });
			const accordionItemId = await addBlock(tx, fieldId, "accordion_item", 0, accordionId);
			await tx
				.insert(schema.accordionItemContentBlocks)
				.values({ id: accordionItemId, title: "An item" });
			const accordionBodyId = await addBlock(tx, fieldId, "rich_text", 0, accordionItemId);
			await tx
				.insert(schema.richTextContentBlocks)
				.values({ id: accordionBodyId, content: untidy("Accordion prose") });

			/** A block already tidy must not be reported, or "needs cleanup" means nothing. */
			const cleanId = await addBlock(tx, fieldId, "image", 8);
			await tx
				.insert(schema.imageContentBlocks)
				.values({ id: cleanId, imageId: asset.id, caption: tidy("Already tidy") });

			const { blocks } = await findRichTextNeedingCleanup(tx);
			const found = new Map(blocks.map((block) => [block.contentBlockId, block.blockType]));

			expect(found.get(richTextId)).toBe("rich_text");
			expect(found.get(calloutBodyId)).toBe("rich_text");
			expect(found.get(imageId)).toBe("image");
			expect(found.get(embedId)).toBe("embed");
			expect(found.get(mediaTextId)).toBe("media_text");
			expect(found.get(heroId)).toBe("hero");
			expect(found.get(galleryId)).toBe("gallery");
			expect(found.get(accordionBodyId)).toBe("rich_text");
			expect(found.has(cleanId)).toBe(false);
		});
	});

	it("rewrites the captions it reports, and reports them no more", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const asset = await getAsset(tx);

			const imageId = await addBlock(tx, fieldId, "image", 0);
			await tx
				.insert(schema.imageContentBlocks)
				.values({ id: imageId, imageId: asset.id, caption: untidy("Image caption") });

			const galleryId = await addBlock(tx, fieldId, "gallery", 1);
			await tx.insert(schema.galleryContentBlocks).values({ id: galleryId, layout: "grid" });
			const [item] = await tx
				.insert(schema.galleryContentBlockItems)
				.values({
					galleryContentBlockId: galleryId,
					imageId: asset.id,
					position: 0,
					caption: untidy("Gallery caption"),
				})
				.returning({ id: schema.galleryContentBlockItems.id });
			assert(item);

			const result = await cleanRichText(tx, [imageId, galleryId]);
			expect(result).toMatchObject({ cleanedCount: 2, skippedIds: [] });

			const image = await tx.query.imageContentBlocks.findFirst({
				where: { id: imageId },
				columns: { caption: true },
			});
			expect(image?.caption).toStrictEqual(tidy("Image caption"));

			const galleryItem = await tx.query.galleryContentBlockItems.findFirst({
				where: { id: item.id },
				columns: { caption: true },
			});
			expect(galleryItem?.caption).toStrictEqual(tidy("Gallery caption"));

			const { blocks } = await findRichTextNeedingCleanup(tx);
			const remaining = new Set(blocks.map((block) => block.contentBlockId));
			expect(remaining.has(imageId)).toBe(false);
			expect(remaining.has(galleryId)).toBe(false);

			/** One audit event per rewritten block, naming the cleanup that wrote it. */
			const events = await tx
				.select({ subjectId: schema.auditLogs.subjectId, summary: schema.auditLogs.summary })
				.from(schema.auditLogs)
				.where(eq(schema.auditLogs.subjectId, galleryId));

			expect(events).toHaveLength(1);
			expect(events[0]?.summary).toMatchObject({
				cleanup: "normalize_rich_text",
				blockType: "gallery",
			});
		});
	});

	// A gallery holds richtext in two places, and the item rows were the only ones the service used to
	// reach. A gallery whose items are all tidy is what tells the two apart.
	it("reaches a gallery's own caption, not only its items'", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const asset = await getAsset(tx);

			const galleryId = await addBlock(tx, fieldId, "gallery", 0);
			await tx
				.insert(schema.galleryContentBlocks)
				.values({ id: galleryId, layout: "grid", caption: untidy("The set") });
			await tx.insert(schema.galleryContentBlockItems).values({
				galleryContentBlockId: galleryId,
				imageId: asset.id,
				position: 0,
				caption: tidy("One image"),
			});

			const { blocks } = await findRichTextNeedingCleanup(tx);
			expect(blocks.map((block) => block.contentBlockId)).toContain(galleryId);

			await cleanRichText(tx, [galleryId]);

			const gallery = await tx.query.galleryContentBlocks.findFirst({
				where: { id: galleryId },
				columns: { caption: true },
			});
			expect(gallery?.caption).toStrictEqual(tidy("The set"));

			const { blocks: remaining } = await findRichTextNeedingCleanup(tx);
			expect(remaining.map((block) => block.contentBlockId)).not.toContain(galleryId);
		});
	});

	it("leaves a block's prose alone when only its caption was untidy", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const asset = await getAsset(tx);
			const prose = tidy("Media prose");

			const mediaTextId = await addBlock(tx, fieldId, "media_text", 0);
			await tx.insert(schema.mediaTextContentBlocks).values({
				id: mediaTextId,
				imageId: asset.id,
				content: prose,
				caption: untidy("Media caption"),
			});

			await cleanRichText(tx, [mediaTextId]);

			const block = await tx.query.mediaTextContentBlocks.findFirst({
				where: { id: mediaTextId },
				columns: { content: true, caption: true },
			});

			expect(block?.content).toStrictEqual(prose);
			expect(block?.caption).toStrictEqual(tidy("Media caption"));
		});
	});
});
