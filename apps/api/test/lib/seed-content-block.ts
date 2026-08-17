import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { v7 as uuidv7 } from "uuid";

import type { Database } from "@/middlewares/db";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function seedContentBlock(
	db: Database,
	entityVersionId: string,
	entityTypeId: string,
	fieldName: string,
	// eslint-disable-next-line unicorn/no-object-as-default-parameter
	content: JSONContent = { type: "doc", content: [] },
) {
	const [blockType, fieldNameRecord] = await Promise.all([
		db.query.contentBlockTypes.findFirst({
			columns: { id: true },
			where: { type: "rich_text" },
		}),
		db.query.entityTypesFieldsNames.findFirst({
			columns: { id: true },
			where: { entityTypeId, fieldName },
		}),
	]);

	assert(blockType, "No rich_text content block type in database.");
	assert(fieldNameRecord, `No field name '${fieldName}' for entity type in database.`);

	const fieldId = uuidv7();
	const blockId = uuidv7();

	await db
		.insert(schema.fields)
		.values({ id: fieldId, entityVersionId, fieldNameId: fieldNameRecord.id });
	await db
		.insert(schema.contentBlocks)
		.values({ id: blockId, fieldId, typeId: blockType.id, position: 0 });
	await db.insert(schema.richTextContentBlocks).values({ id: blockId, content });

	return { content };
}
