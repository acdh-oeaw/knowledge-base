import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import type { ContentBlockInput } from "@/lib/content-block-input";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import type { Transaction } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";

export async function ensureEntityVersionField(
	tx: Transaction,
	entityVersionId: string,
	fieldName: string,
): Promise<{ id: string }> {
	const existingField = await tx.query.fields.findFirst({
		where: {
			entityVersionId,
			name: { fieldName },
		},
		columns: { id: true },
	});

	if (existingField != null) {
		return existingField;
	}

	const [version] = await tx
		.select({ entityTypeId: schema.entities.typeId })
		.from(schema.entityVersions)
		.innerJoin(schema.entities, eq(schema.entityVersions.entityId, schema.entities.id))
		.where(eq(schema.entityVersions.id, entityVersionId))
		.limit(1);

	assert(version);

	const fieldNameRow = await tx.query.entityTypesFieldsNames.findFirst({
		where: { entityTypeId: version.entityTypeId, fieldName },
		columns: { id: true },
	});

	assert(fieldNameRow);

	const [field] = await tx
		.insert(schema.fields)
		.values({ entityVersionId, fieldNameId: fieldNameRow.id })
		.returning({ id: schema.fields.id });

	assert(field);

	return field;
}

export async function upsertRichTextEntityVersionField(
	tx: Transaction,
	entityVersionId: string,
	fieldName: string,
	content: schema.RichTextContentBlock["content"],
): Promise<void> {
	const field = await ensureEntityVersionField(tx, entityVersionId, fieldName);

	const richTextType = await tx.query.contentBlockTypes.findFirst({
		where: { type: "rich_text" },
		columns: { id: true },
	});

	assert(richTextType);

	const existingContentBlock = await tx.query.contentBlocks.findFirst({
		where: {
			fieldId: field.id,
			type: { type: "rich_text" },
		},
		columns: { id: true },
	});

	if (existingContentBlock == null) {
		const [newContentBlock] = await tx
			.insert(schema.contentBlocks)
			.values({ fieldId: field.id, typeId: richTextType.id, position: 0 })
			.returning({ id: schema.contentBlocks.id });

		assert(newContentBlock);

		await tx.insert(schema.richTextContentBlocks).values({
			id: newContentBlock.id,
			content,
		});

		return;
	}

	const existingRichText = await tx.query.richTextContentBlocks.findFirst({
		where: { id: existingContentBlock.id },
		columns: { id: true },
	});

	if (existingRichText != null) {
		await tx
			.update(schema.richTextContentBlocks)
			.set({ content })
			.where(eq(schema.richTextContentBlocks.id, existingContentBlock.id));
	} else {
		await tx.insert(schema.richTextContentBlocks).values({
			id: existingContentBlock.id,
			content,
		});
	}
}

export async function replaceEntityVersionFieldContentBlocks(
	tx: Transaction,
	entityVersionId: string,
	fieldName: string,
	contentBlocks: Array<ContentBlockInput>,
): Promise<void> {
	const field = await ensureEntityVersionField(tx, entityVersionId, fieldName);
	const contentBlockTypes = await tx.query.contentBlockTypes.findMany({
		columns: { id: true, type: true },
	});
	const contentBlockTypesByType = new Map(contentBlockTypes.map((item) => [item.type, item]));

	const existingBlocks = await tx.query.contentBlocks.findMany({
		where: { fieldId: field.id },
		columns: { id: true },
	});
	const existingBlockIds = existingBlocks.map((block) => block.id);

	if (existingBlockIds.length > 0) {
		await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.id, existingBlockIds));
	}

	await Promise.all(
		contentBlocks.map(async (contentBlock, index) => {
			const contentBlockType = contentBlockTypesByType.get(contentBlock.type);
			assert(contentBlockType);

			const [added] = await tx
				.insert(schema.contentBlocks)
				.values({ fieldId: field.id, typeId: contentBlockType.id, position: index })
				.returning({ id: schema.contentBlocks.id });
			assert(added);

			await upsertTypedContentBlock(tx, contentBlock, added.id, true);
		}),
	);
}
