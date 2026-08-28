import { isNonEmptyString } from "@acdh-oeaw/lib";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database, Transaction } from "./index";
import { isEmptyRichTextDocument } from "./rich-text";
import * as schema from "./schema";

/**
 * Detects and removes semantically empty content blocks. Two things count as empty, and both are a
 * block that would render as nothing:
 *
 * - A `rich_text` block whose document has no meaningful content (empty paragraphs, stray hard
 *   breaks, whitespace) — wherever in the tree it sits, including the body of a callout or an
 *   accordion panel;
 * - A container block (`callout`, `accordion`, `accordion_item`) left with no children and no visible
 *   title of its own.
 *
 * The two converge over successive runs rather than in one pass: emptying a callout's only child
 * makes the callout itself empty, which the next run reports. That is deliberate — each run only
 * deletes what is provably empty at the time it looks, so nothing is removed on the strength of a
 * deletion that has not happened yet.
 *
 * Shared by the `@dariah-eric/maintenance` cli and the admin dashboard, so both use the exact same
 * definition of "empty".
 */

/** JSON-serializable so findings can cross a server/client boundary. */
export interface EmptyContentBlock {
	contentBlockId: string;
	entityId: string;
	entityType: string;
	entityLabel: string | null;
	entitySlug: string;
	fieldName: string;
	/** Lifecycle status of the owning entity version (e.g. `draft`, `published`). */
	status: string;
	position: number;
}

export interface EmptyContentBlocksResult {
	blocks: Array<EmptyContentBlock>;
	total: number;
}

interface RichTextBlockRow extends EmptyContentBlock {
	content: (typeof schema.richTextContentBlocks.$inferSelect)["content"];
}

/** Every `rich_text` content block joined to its owning entity version and field, for review. */
async function getRichTextBlocks(db: Database | Transaction): Promise<Array<RichTextBlockRow>> {
	return db
		.select({
			contentBlockId: schema.contentBlocks.id,
			content: schema.richTextContentBlocks.content,
			position: schema.contentBlocks.position,
			entityId: schema.entities.id,
			entityLabel: schema.entities.label,
			entitySlug: schema.slugs.value,
			entityType: schema.entityTypes.type,
			fieldName: schema.entityTypesFieldsNames.fieldName,
			status: schema.entityStatus.type,
		})
		.from(schema.richTextContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.richTextContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.entityTypesFieldsNames.id, schema.fields.fieldNameId),
		)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));
}

/** The block types that hold their content as children rather than in a column of their own. */
const containerBlockTypes = ["accordion", "accordion_item", "callout"] as const;

/**
 * Container blocks with nothing in them — an accordion with no panels, or an untitled callout or
 * panel with no body. The left join is to the children themselves, so "no children" is the absence
 * of a joined row rather than a count. The typed joins protect titles that render independently of
 * child content.
 */
async function getEmptyContainerBlocks(
	db: Database | Transaction,
): Promise<Array<EmptyContentBlock>> {
	const childContentBlocks = alias(schema.contentBlocks, "child_content_blocks");

	const rows = await db
		.select({
			contentBlockId: schema.contentBlocks.id,
			blockType: schema.contentBlockTypes.type,
			calloutTitle: schema.calloutContentBlocks.title,
			accordionItemTitle: schema.accordionItemContentBlocks.title,
			position: schema.contentBlocks.position,
			entityId: schema.entities.id,
			entityLabel: schema.entities.label,
			entitySlug: schema.slugs.value,
			entityType: schema.entityTypes.type,
			fieldName: schema.entityTypesFieldsNames.fieldName,
			status: schema.entityStatus.type,
		})
		.from(schema.contentBlocks)
		.innerJoin(
			schema.contentBlockTypes,
			eq(schema.contentBlockTypes.id, schema.contentBlocks.typeId),
		)
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.entityTypesFieldsNames.id, schema.fields.fieldNameId),
		)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.leftJoin(
			schema.calloutContentBlocks,
			eq(schema.calloutContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(
			schema.accordionItemContentBlocks,
			eq(schema.accordionItemContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(childContentBlocks, eq(childContentBlocks.parentBlockId, schema.contentBlocks.id))
		.where(
			and(
				inArray(schema.contentBlockTypes.type, [...containerBlockTypes]),
				isNull(childContentBlocks.id),
			),
		);

	return rows.flatMap(
		({ blockType, calloutTitle, accordionItemTitle, ...block }): Array<EmptyContentBlock> => {
			const title = blockType === "callout" ? calloutTitle : accordionItemTitle;

			return isNonEmptyString(title?.trim()) ? [] : [block];
		},
	);
}

export async function findEmptyContentBlocks(
	db: Database | Transaction,
): Promise<EmptyContentBlocksResult> {
	const [rows, emptyContainers] = await Promise.all([
		getRichTextBlocks(db),
		getEmptyContainerBlocks(db),
	]);

	const blocks = [
		...rows
			.filter((row) => isEmptyRichTextDocument(row.content))
			.map(({ content: _content, ...block }): EmptyContentBlock => block),
		...emptyContainers,
	].toSorted(
		(a, b) =>
			a.entityType.localeCompare(b.entityType) ||
			(a.entityLabel ?? a.entitySlug).localeCompare(b.entityLabel ?? b.entitySlug) ||
			a.status.localeCompare(b.status) ||
			a.fieldName.localeCompare(b.fieldName) ||
			a.position - b.position ||
			a.contentBlockId.localeCompare(b.contentBlockId),
	);

	return { blocks, total: blocks.length };
}

export interface DeleteEmptyContentBlocksOptions {
	/** Recorded as the actor of the `delete` audit events; `null` for system/cli runs. */
	actorUserId?: string | null;
}

export interface DeleteEmptyContentBlocksResult {
	deletedCount: number;
	/** Ids requested but not deleted because they are no longer empty or no longer exist. */
	skippedIds: Array<string>;
}

/**
 * Deletes the given content blocks, but only those which are _still_ empty at call time — the empty
 * set is recomputed here rather than trusting the caller's ids, so a block edited to have content
 * in the meantime is protected. Deleting the `content_blocks` row cascades to its typed row — and,
 * for a container, to its subtree, though a container only reaches this list once it has none.
 */
export async function deleteEmptyContentBlocks(
	db: Database | Transaction,
	ids: Array<string>,
	options: DeleteEmptyContentBlocksOptions = {},
): Promise<DeleteEmptyContentBlocksResult> {
	const { actorUserId = null } = options;

	const requested = new Set(ids);
	const { blocks } = await findEmptyContentBlocks(db);
	const deletable = blocks.filter((block) => requested.has(block.contentBlockId));
	const deletableIds = new Set(deletable.map((block) => block.contentBlockId));
	const skippedIds = ids.filter((id) => !deletableIds.has(id));

	if (deletable.length === 0) {
		return { deletedCount: 0, skippedIds };
	}

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.contentBlocks)
			.where(inArray(schema.contentBlocks.id, [...deletableIds]));
		await tx.insert(schema.auditLogs).values(
			deletable.map((block) => {
				return {
					action: "delete" as const,
					actorUserId,
					subjectType: "content_block",
					subjectId: block.contentBlockId,
					summary: {
						entityId: block.entityId,
						entityType: block.entityType,
						fieldName: block.fieldName,
						status: block.status,
					},
				};
			}),
		);
	});

	return { deletedCount: deletable.length, skippedIds };
}
