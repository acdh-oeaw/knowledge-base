import { assert } from "@acdh-oeaw/lib";
import { isEmptyRichTextDocument, withoutBlankParagraphs } from "@dariah-eric/database/rich-text";
import * as schema from "@dariah-eric/database/schema";

import { type ContentBlockInput, getContentBlockInputChildren } from "@/lib/content-block-input";
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
	rawContent: schema.RichTextContentBlock["content"],
): Promise<void> {
	// Spacer paragraphs are stripped before the empty check, so a field left holding only blank lines
	// drops its content block instead of storing them.
	const content = withoutBlankParagraphs(rawContent);
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

	if (isEmptyRichTextDocument(content)) {
		if (existingContentBlock != null) {
			await tx
				.delete(schema.contentBlocks)
				.where(eq(schema.contentBlocks.id, existingContentBlock.id));
		}
		return;
	}

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

/**
 * Writes one level of blocks and, for each, whatever it contains — the container row first, so its
 * children have a parent to point at.
 *
 * `position` counts within the level, not across the field: a callout's body starts at 0 again, and
 * a block's place is only ever meaningful among its siblings.
 *
 * A child of a type its container may not hold is dropped rather than written. The editor cannot
 * produce one, so this is the guard for everything else that reaches the write path — an import, a
 * hand-built payload, a stale form — and it is where the vocabulary in `allowedChildBlockTypes` is
 * enforced, since no `CHECK` can see a parent's type from the child's row.
 */
async function insertContentBlockLevel(
	tx: Transaction,
	fieldId: string,
	parentBlockId: string | null,
	blocks: Array<ContentBlockInput>,
	contentBlockTypesByType: Map<string, { id: string }>,
): Promise<void> {
	await Promise.all(
		blocks.map(async (contentBlock, index) => {
			const contentBlockType = contentBlockTypesByType.get(contentBlock.type);
			assert(contentBlockType);

			const [added] = await tx
				.insert(schema.contentBlocks)
				.values({
					fieldId,
					typeId: contentBlockType.id,
					parentBlockId,
					position: index,
				})
				.returning({ id: schema.contentBlocks.id });
			assert(added);

			await upsertTypedContentBlock(tx, contentBlock, added.id, true);

			const children = getContentBlockInputChildren(contentBlock).filter((child) =>
				schema.isAllowedChildBlockType(contentBlock.type, child.type),
			);

			if (children.length > 0) {
				await insertContentBlockLevel(tx, fieldId, added.id, children, contentBlockTypesByType);
			}
		}),
	);
}

/**
 * Writes a field's content blocks, containers and all, into an empty field.
 *
 * Every entity's save path goes through here. They all write the same way — the field is cleared
 * and the submitted tree written fresh — rather than reconciling block by block: a block carries no
 * identity an author would recognise, nothing outside the tree references one, and matching a
 * submitted subtree against a stored one would be a great deal of machinery for no observable
 * difference.
 */
export async function insertContentBlockTree(
	tx: Transaction,
	fieldId: string,
	contentBlocks: Array<ContentBlockInput>,
): Promise<void> {
	const contentBlockTypes = await tx.query.contentBlockTypes.findMany({
		columns: { id: true, type: true },
	});
	const contentBlockTypesByType = new Map(contentBlockTypes.map((item) => [item.type, item]));

	await insertContentBlockLevel(tx, fieldId, null, contentBlocks, contentBlockTypesByType);
}

/** Every content block a field owns, nested ones included — they all carry its `field_id`. */
export async function deleteFieldContentBlocks(tx: Transaction, fieldId: string): Promise<void> {
	const existingBlocks = await tx.query.contentBlocks.findMany({
		where: { fieldId },
		columns: { id: true },
	});
	const existingBlockIds = existingBlocks.map((block) => block.id);

	// Deleting a container first cascades to children already named here, which is harmless: the
	// rows are gone either way.
	if (existingBlockIds.length > 0) {
		await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.id, existingBlockIds));
	}
}

export async function replaceEntityVersionFieldContentBlocks(
	tx: Transaction,
	entityVersionId: string,
	fieldName: string,
	contentBlocks: Array<ContentBlockInput>,
): Promise<void> {
	const field = await ensureEntityVersionField(tx, entityVersionId, fieldName);

	await deleteFieldContentBlocks(tx, field.id);
	await insertContentBlockTree(tx, field.id, contentBlocks);
}
