/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function getContentBlockTypes() {
	const contentBlockTypes = await db.query.contentBlockTypes.findMany({
		columns: {
			id: true,
			type: true,
		},
	});

	return contentBlockTypes;
}

export async function getContentBlockByType(type: schema.ContentBlockTypes["type"]) {
	const contentBlockType = await db.query.contentBlockTypes.findFirst({
		where: {
			type,
		},
	});

	return contentBlockType;
}

interface CreateContentBlocksParams {
	data: Array<schema.ContentBlockInput>;
}

export async function createContentBlocks(params: CreateContentBlocksParams) {
	const { data } = params;

	const contentBlockIds = await db.insert(schema.contentBlocks).values(data).returning({
		id: schema.contentBlocks.id,
		typeId: schema.contentBlocks.typeId,
	});

	return contentBlockIds;
}

interface CreateRichTextContentBlockParams {
	fieldId: string;
	typeId: string;
	content: schema.RichTextContentBlock["content"];
	position?: number;
}

export async function createRichTextContentBlock(params: CreateRichTextContentBlockParams) {
	const { fieldId, typeId, content, position = 0 } = params;

	const [contentBlock] = await db
		.insert(schema.contentBlocks)
		.values({
			fieldId,
			typeId,
			position,
		})
		.returning({ id: schema.contentBlocks.id });

	if (!contentBlock) {
		throw new Error("Failed to create content block");
	}

	const [richTextBlock] = await db
		.insert(schema.richTextContentBlocks)
		.values({
			id: contentBlock.id,
			content,
		})
		.returning({ id: schema.richTextContentBlocks.id });

	return richTextBlock;
}

export async function getRichTextContentBlock(id: string) {
	const richTextBlock = await db.query.richTextContentBlocks.findFirst({
		where: {
			id,
		},
	});

	return richTextBlock;
}

interface UpdateRichTextContentBlockParams {
	id: string;
	content: schema.RichTextContentBlock["content"];
}

export async function updateRichTextContentBlock(params: UpdateRichTextContentBlockParams) {
	const { id, content } = params;

	const [updated] = await db
		.update(schema.richTextContentBlocks)
		.set({ content })
		.where(eq(schema.richTextContentBlocks.id, id))
		.returning({ id: schema.richTextContentBlocks.id });

	return updated;
}

export async function deleteRichTextContentBlock(id: string) {
	await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, id));
}
