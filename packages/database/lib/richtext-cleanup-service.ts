import type { JSONContent } from "@tiptap/core";
import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import { normalizeRichTextDocument } from "./rich-text-normalize";
import * as schema from "./schema";

/**
 * Detects and rewrites rich-text content that {@link normalizeRichTextDocument} would tidy (empty
 * spacer paragraphs, stray `<br>`/whitespace, `&nbsp;`, imported HTML attributes, bold headings).
 * Shared by the `@dariah-eric/maintenance` cli and the admin dashboard, so both normalise
 * identically.
 *
 * Every block that stores richtext is covered, wherever it keeps it: the prose of a `rich_text` or
 * `media_text` block, and the captions on `image`, `media_text`, `embed`, `hero` and `gallery`
 * blocks. A caption is written in the same editor as the prose around it, and pasted into from the
 * same sources, so it collects the same oddities — and, being a document of its own, it was the
 * half this service never reached.
 *
 * Container blocks (`callout`, `accordion`, `accordion_item`) need no case of their own: their
 * prose is their children, so it is reached as the `rich_text` blocks it is stored as, wherever in
 * the tree those sit.
 *
 * The one richtext outside a content block is an asset's own caption, edited in the media library.
 * Its findings would not be content blocks, so they are not reported here.
 */

/**
 * Which content blocks hold richtext of their own. `data` holds none, and the container types hold
 * only their children (plus, for an `accordion_item`, a plain-text title).
 */
export type RichTextCleanupBlockType = Exclude<
	(typeof schema.contentBlockTypesEnum)[number],
	"accordion" | "accordion_item" | "callout" | "data"
>;

/** JSON-serializable so findings can cross a server/client boundary. */
export interface RichTextCleanupBlock {
	contentBlockId: string;
	blockType: RichTextCleanupBlockType;
	entityId: string;
	entityType: string;
	entityLabel: string | null;
	entitySlug: string;
	fieldName: string;
	/** Lifecycle status of the owning entity version (e.g. `draft`, `published`). */
	status: string;
	position: number;
}

export interface RichTextCleanupResult {
	blocks: Array<RichTextCleanupBlock>;
	total: number;
}

/** Deterministic serialisation (sorted keys) so `jsonb` key reordering is not seen as a change. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		return `{${Object.keys(value)
			.toSorted()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/**
 * One content block, with whether normalising moved anything and how the result is written back.
 *
 * The write is a closure rather than a value because a block's richtext lives in a different table
 * — and, for a gallery, in a row per item — for each block type. Building it where the row was read
 * keeps every type's storage in one place instead of split across a second switch at write time.
 */
interface BlockCleanup {
	block: RichTextCleanupBlock;
	changed: boolean;
	write: (tx: Transaction) => Promise<unknown>;
}

/**
 * The normalised documents of one row's richtext columns, and whether any of them moved.
 *
 * Only the columns that changed are returned, so an update writes the caption it tidied without
 * touching the prose beside it.
 */
function normalizeColumns<T extends Record<string, JSONContent | null>>(
	columns: T,
): { changed: boolean; values: { [K in keyof T]?: JSONContent } } {
	const values: { [K in keyof T]?: JSONContent } = {};
	let changed = false;

	for (const [name, value] of Object.entries(columns)) {
		if (value == null) {
			continue;
		}

		const normalized = normalizeRichTextDocument(value);

		if (stableStringify(normalized) !== stableStringify(value)) {
			values[name as keyof T] = normalized;
			changed = true;
		}
	}

	return { changed, values };
}

async function computeCleanups(db: Database | Transaction): Promise<Array<BlockCleanup>> {
	const rows = await db
		.select({
			contentBlockId: schema.contentBlocks.id,
			blockType: schema.contentBlockTypes.type,
			position: schema.contentBlocks.position,
			richTextContent: schema.richTextContentBlocks.content,
			embedCaption: schema.embedContentBlocks.caption,
			galleryCaption: schema.galleryContentBlocks.caption,
			heroCaption: schema.heroContentBlocks.caption,
			imageCaption: schema.imageContentBlocks.caption,
			mediaTextContent: schema.mediaTextContentBlocks.content,
			mediaTextCaption: schema.mediaTextContentBlocks.caption,
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
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(schema.embedContentBlocks, eq(schema.embedContentBlocks.id, schema.contentBlocks.id))
		// Only the gallery's own row — its items are one-to-many and are fetched separately below.
		.leftJoin(
			schema.galleryContentBlocks,
			eq(schema.galleryContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(schema.heroContentBlocks, eq(schema.heroContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(schema.imageContentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(
			schema.mediaTextContentBlocks,
			eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
		);

	// A gallery keeps a row per item, so its captions are fetched separately rather than multiplying
	// every gallery block by its item count in the join above.
	const galleryBlockIds = rows
		.filter((row) => row.blockType === "gallery")
		.map((row) => row.contentBlockId);
	const galleryItems =
		galleryBlockIds.length > 0
			? await db
					.select({
						id: schema.galleryContentBlockItems.id,
						galleryContentBlockId: schema.galleryContentBlockItems.galleryContentBlockId,
						caption: schema.galleryContentBlockItems.caption,
					})
					.from(schema.galleryContentBlockItems)
					.where(inArray(schema.galleryContentBlockItems.galleryContentBlockId, galleryBlockIds))
			: [];

	const galleryItemsByBlockId = new Map<string, typeof galleryItems>();
	for (const item of galleryItems) {
		const existing = galleryItemsByBlockId.get(item.galleryContentBlockId) ?? [];
		existing.push(item);
		galleryItemsByBlockId.set(item.galleryContentBlockId, existing);
	}

	const cleanups: Array<BlockCleanup> = [];

	for (const row of rows) {
		const { contentBlockId } = row;
		const base = {
			contentBlockId,
			entityId: row.entityId,
			entityType: row.entityType,
			entityLabel: row.entityLabel,
			entitySlug: row.entitySlug,
			fieldName: row.fieldName,
			status: row.status,
			position: row.position,
		};

		function pushCleanup(
			blockType: RichTextCleanupBlockType,
			changed: boolean,
			write: BlockCleanup["write"],
		) {
			cleanups.push({ block: { ...base, blockType }, changed, write });
		}

		switch (row.blockType) {
			case "rich_text": {
				const { changed, values } = normalizeColumns({ content: row.richTextContent });

				pushCleanup("rich_text", changed, (tx) =>
					tx
						.update(schema.richTextContentBlocks)
						.set(values)
						.where(eq(schema.richTextContentBlocks.id, contentBlockId)),
				);
				break;
			}

			case "media_text": {
				const { changed, values } = normalizeColumns({
					content: row.mediaTextContent,
					caption: row.mediaTextCaption,
				});

				pushCleanup("media_text", changed, (tx) =>
					tx
						.update(schema.mediaTextContentBlocks)
						.set(values)
						.where(eq(schema.mediaTextContentBlocks.id, contentBlockId)),
				);
				break;
			}

			case "image": {
				const { changed, values } = normalizeColumns({ caption: row.imageCaption });

				pushCleanup("image", changed, (tx) =>
					tx
						.update(schema.imageContentBlocks)
						.set(values)
						.where(eq(schema.imageContentBlocks.id, contentBlockId)),
				);
				break;
			}

			case "embed": {
				const { changed, values } = normalizeColumns({ caption: row.embedCaption });

				pushCleanup("embed", changed, (tx) =>
					tx
						.update(schema.embedContentBlocks)
						.set(values)
						.where(eq(schema.embedContentBlocks.id, contentBlockId)),
				);
				break;
			}

			case "hero": {
				const { changed, values } = normalizeColumns({ caption: row.heroCaption });

				pushCleanup("hero", changed, (tx) =>
					tx
						.update(schema.heroContentBlocks)
						.set(values)
						.where(eq(schema.heroContentBlocks.id, contentBlockId)),
				);
				break;
			}

			case "gallery": {
				// The gallery's own caption lives on its row; its items' captions in a row each.
				const { changed, values } = normalizeColumns({ caption: row.galleryCaption });

				const items = galleryItemsByBlockId.get(contentBlockId) ?? [];
				const movedItems = items.flatMap((item) => {
					if (item.caption == null) {
						return [];
					}

					const caption = normalizeRichTextDocument(item.caption);

					return stableStringify(caption) === stableStringify(item.caption)
						? []
						: [{ id: item.id, caption }];
				});

				pushCleanup("gallery", changed || movedItems.length > 0, async (tx) => {
					if (changed) {
						await tx
							.update(schema.galleryContentBlocks)
							.set(values)
							.where(eq(schema.galleryContentBlocks.id, contentBlockId));
					}

					for (const item of movedItems) {
						await tx
							.update(schema.galleryContentBlockItems)
							.set({ caption: item.caption })
							.where(eq(schema.galleryContentBlockItems.id, item.id));
					}
				});
				break;
			}

			// Blocks with no richtext of their own: `data` stores the ids of the entities it lists, and a
			// container's prose is its children, each reached as the `rich_text` block it is. An
			// `accordion_item`'s title is plain text, so there is no document to normalise. Matched by
			// name rather than left to a default, so a new block type is a type error here until
			// somebody decides whether it carries richtext.
			case "accordion":
			case "accordion_item":
			case "callout":
			case "data": {
				break;
			}
		}
	}

	return cleanups;
}

export async function findRichTextNeedingCleanup(
	db: Database | Transaction,
): Promise<RichTextCleanupResult> {
	const cleanups = await computeCleanups(db);

	const blocks = cleanups
		.filter((cleanup) => cleanup.changed)
		.map((cleanup) => cleanup.block)
		.toSorted(
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

export interface CleanRichTextOptions {
	/** Recorded as the actor of the `update` audit events; `null` for system/cli runs. */
	actorUserId?: string | null;
}

export interface CleanRichTextResult {
	cleanedCount: number;
	/** Ids requested but not rewritten because they no longer need cleanup or no longer exist. */
	skippedIds: Array<string>;
}

/**
 * Rewrites the given content blocks with their normalised rich text, but only those which _still_
 * need cleanup at call time — recomputed here rather than trusting the caller's ids, so a block
 * edited in the meantime is not clobbered. Writes one `update` audit event per rewritten block.
 */
export async function cleanRichText(
	db: Database | Transaction,
	ids: Array<string>,
	options: CleanRichTextOptions = {},
): Promise<CleanRichTextResult> {
	const { actorUserId = null } = options;

	const requested = new Set(ids);
	const cleanups = await computeCleanups(db);
	const applicable = cleanups.filter(
		(cleanup) => cleanup.changed && requested.has(cleanup.block.contentBlockId),
	);
	const applicableIds = new Set(applicable.map((cleanup) => cleanup.block.contentBlockId));
	const skippedIds = ids.filter((id) => !applicableIds.has(id));

	if (applicable.length === 0) {
		return { cleanedCount: 0, skippedIds };
	}

	await db.transaction(async (tx) => {
		for (const cleanup of applicable) {
			await cleanup.write(tx);
		}

		await tx.insert(schema.auditLogs).values(
			applicable.map((cleanup) => {
				return {
					action: "update" as const,
					actorUserId,
					subjectType: "content_block",
					subjectId: cleanup.block.contentBlockId,
					summary: {
						cleanup: "normalize_rich_text",
						blockType: cleanup.block.blockType,
						entityId: cleanup.block.entityId,
						entityType: cleanup.block.entityType,
						fieldName: cleanup.block.fieldName,
						status: cleanup.block.status,
					},
				};
			}),
		);
	});

	return { cleanedCount: applicable.length, skippedIds };
}
