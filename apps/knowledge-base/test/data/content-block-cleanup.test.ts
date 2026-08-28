import { assert } from "@acdh-oeaw/lib";
import { findEmptyContentBlocks } from "@dariah-eric/database/content-block-cleanup-service";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import { createDraftDocument } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

async function seedField(tx: Transaction): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(entityType);

	const title = f.lorem.sentence();
	const { versionId } = await createDraftDocument(tx, entityType.id, slugify(title));
	const asset = await tx.query.assets.findFirst({ columns: { id: true } });
	assert(asset);

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
	assert(blockType);

	const [block] = await tx
		.insert(schema.contentBlocks)
		.values({ fieldId, typeId: blockType.id, position, parentBlockId })
		.returning({ id: schema.contentBlocks.id });
	assert(block);

	return block.id;
}

describe("empty content block cleanup", () => {
	it("does not classify a titled callout with no body as empty", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const calloutId = await addBlock(tx, fieldId, "callout", 0);
			await tx
				.insert(schema.calloutContentBlocks)
				.values({ id: calloutId, intent: "info", title: "Important" });

			const { blocks } = await findEmptyContentBlocks(tx);

			expect(blocks.some((block) => block.contentBlockId === calloutId)).toBe(false);
		});
	});

	it("does not classify a titled accordion panel with no body as empty", async () => {
		await withTransaction(async (tx) => {
			const fieldId = await seedField(tx);
			const accordionId = await addBlock(tx, fieldId, "accordion", 0);
			await tx.insert(schema.accordionContentBlocks).values({ id: accordionId });
			const itemId = await addBlock(tx, fieldId, "accordion_item", 0, accordionId);
			await tx.insert(schema.accordionItemContentBlocks).values({ id: itemId, title: "Details" });

			const { blocks } = await findEmptyContentBlocks(tx);

			expect(blocks.some((block) => block.contentBlockId === itemId)).toBe(false);
		});
	});
});
