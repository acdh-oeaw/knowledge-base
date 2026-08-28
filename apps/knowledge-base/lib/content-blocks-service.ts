import type { ImageCaptionMode } from "@dariah-eric/database/image-captions";
import {
	annotateEntityLinkTargets,
	collectLinkTargetEntityIds,
} from "@dariah-eric/database/link-targets";
import {
	annotatePlaceholderValues,
	collectPlaceholderValueKinds,
} from "@dariah-eric/database/placeholder-values";
import { getPlaceholderValues } from "@dariah-eric/database/placeholder-values-service";
import { isEmptyRichTextDocument, withoutBlankParagraphs } from "@dariah-eric/database/rich-text";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import type { SelectedImage } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/selected-image-card";
import { imageGridOptions } from "@/config/assets.config";
import type { ContentBlockInput } from "@/lib/content-block-input";
import { getEntityRelationOptionsByIds } from "@/lib/data/relations";
import { type Transaction, db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";
import { images } from "@/lib/images";

async function getAssetIdByKey(tx: Transaction, key: string): Promise<string | null> {
	const asset = await tx.query.assets.findFirst({
		where: { key },
		columns: { id: true },
	});

	return asset?.id ?? null;
}

/**
 * The picked asset as the dashboard's image cards want it, assembled from a content-block row's
 * joined asset columns. Read-only context: only `imageKey` is persisted, the rest identifies the
 * asset for the editor.
 */
function toBlockAsset(
	row: {
		imageId: string | null;
		imageKey: string | null;
		imageLabel: string | null;
		imageAlt: string | null;
		imageAssetCaption: JSONContent | null;
		imageLicenseId: string | null;
		imageLicenseCode: string | null;
		imageLicenseName: string | null;
		imageMimeType: string | null;
	},
	url: string,
): SelectedImage | undefined {
	if (row.imageKey == null) {
		return undefined;
	}

	return {
		id: row.imageId,
		key: row.imageKey,
		url,
		label: row.imageLabel,
		alt: row.imageAlt,
		caption: row.imageAssetCaption,
		license:
			row.imageLicenseCode != null && row.imageLicenseName != null
				? { code: row.imageLicenseCode, name: row.imageLicenseName }
				: null,
		licenseId: row.imageLicenseId,
		mimeType: row.imageMimeType,
	};
}

async function createGalleryItems(
	tx: Transaction,
	blockId: string,
	items: Array<{
		imageKey?: string;
		imageUrl?: string;
		caption?: JSONContent | null;
		captionMode?: ImageCaptionMode;
	}> = [],
): Promise<Array<schema.GalleryContentBlockItemInput>> {
	const galleryItems = await Promise.all(
		items.map(async (item, position) => {
			const imageKey = item.imageKey;
			if (imageKey == null) {
				return null;
			}

			const imageId = await getAssetIdByKey(tx, imageKey);
			if (imageId == null) {
				return null;
			}

			const galleryItem: schema.GalleryContentBlockItemInput = {
				galleryContentBlockId: blockId,
				imageId,
				position,
				caption: item.caption ?? null,
				captionMode: item.captionMode ?? (item.caption != null ? "override" : "inherit"),
			};

			return galleryItem;
		}),
	);

	return galleryItems.filter((item): item is schema.GalleryContentBlockItemInput => item != null);
}

/**
 * The empty state for a body that must exist: a document needs at least one block child to be a
 * valid ProseMirror doc, so a body stripped down to nothing goes back to a single empty paragraph
 * rather than an empty `content` array.
 */
function emptyRichTextDocument(): JSONContent {
	return { type: "doc", content: [{ type: "paragraph" }] };
}

/** Strips spacer paragraphs, falling back to the empty state for bodies that cannot be absent. */
function cleanRequiredBody(content: JSONContent | null | undefined): JSONContent {
	const cleaned = withoutBlankParagraphs(content ?? emptyRichTextDocument());

	return isEmptyRichTextDocument(cleaned) ? emptyRichTextDocument() : cleaned;
}

export async function upsertTypedContentBlock(
	tx: Transaction,
	block: ContentBlockInput,
	blockId: string,
	isNew: boolean,
): Promise<void> {
	switch (block.type) {
		case "callout": {
			const intent = block.content?.intent ?? "info";
			const title = block.content?.title?.trim() ?? null;
			if (isNew) {
				await tx.insert(schema.calloutContentBlocks).values({ id: blockId, intent, title });
			} else {
				await tx
					.update(schema.calloutContentBlocks)
					.set({ intent, title })
					.where(eq(schema.calloutContentBlocks.id, blockId));
			}
			break;
		}

		case "rich_text": {
			// Strip spacer paragraphs first, so a block left holding nothing else is recognised as empty
			// and removed rather than stored as a run of blank lines.
			const content = withoutBlankParagraphs(block.content ?? {});
			if (isEmptyRichTextDocument(content)) {
				await tx.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, blockId));
				break;
			}
			if (isNew) {
				await tx.insert(schema.richTextContentBlocks).values({ id: blockId, content });
			} else {
				await tx
					.update(schema.richTextContentBlocks)
					.set({ content })
					.where(eq(schema.richTextContentBlocks.id, blockId));
			}
			break;
		}

		case "image": {
			const imageKey = block.content?.imageKey;
			if (imageKey == null) {
				break;
			}

			const imageId = await getAssetIdByKey(tx, imageKey);
			if (imageId == null) {
				break;
			}

			const caption = block.content?.caption ?? null;
			const captionMode = block.content?.captionMode ?? (caption != null ? "override" : "inherit");
			const layout = block.content?.layout ?? "default";

			if (isNew) {
				await tx.insert(schema.imageContentBlocks).values({
					id: blockId,
					imageId,
					caption,
					captionMode,
					layout,
				});
			} else {
				await tx
					.update(schema.imageContentBlocks)
					.set({ imageId, caption, captionMode, layout })
					.where(eq(schema.imageContentBlocks.id, blockId));
			}
			break;
		}

		case "embed": {
			const url = block.content?.url;
			const title = block.content?.title;
			if (url == null || title == null) {
				break;
			}

			const caption = block.content?.caption ?? null;

			if (isNew) {
				await tx.insert(schema.embedContentBlocks).values({ id: blockId, url, title, caption });
			} else {
				await tx
					.update(schema.embedContentBlocks)
					.set({ url, title, caption })
					.where(eq(schema.embedContentBlocks.id, blockId));
			}
			break;
		}

		case "data": {
			const dataType = block.content?.dataType;
			if (dataType == null) {
				break;
			}

			const dataContentBlockType = await tx.query.dataContentBlockTypes.findFirst({
				where: { type: dataType },
				columns: { id: true },
			});
			if (dataContentBlockType == null) {
				break;
			}

			const limit = block.content?.limit ?? null;
			const selectedIds = block.content?.selectedIds ?? null;

			if (isNew) {
				await tx.insert(schema.dataContentBlocks).values({
					id: blockId,
					typeId: dataContentBlockType.id,
					limit,
					selectedIds,
				});
			} else {
				await tx
					.update(schema.dataContentBlocks)
					.set({ typeId: dataContentBlockType.id, limit, selectedIds })
					.where(eq(schema.dataContentBlocks.id, blockId));
			}
			break;
		}

		case "gallery": {
			const layout = block.content?.layout ?? "grid";
			const galleryCaption = block.content?.caption ?? null;
			const galleryItems = await createGalleryItems(tx, blockId, block.content?.items);

			if (isNew) {
				await tx
					.insert(schema.galleryContentBlocks)
					.values({ id: blockId, layout, caption: galleryCaption });
			} else {
				await tx
					.update(schema.galleryContentBlocks)
					.set({ layout, caption: galleryCaption })
					.where(eq(schema.galleryContentBlocks.id, blockId));
				await tx
					.delete(schema.galleryContentBlockItems)
					.where(eq(schema.galleryContentBlockItems.galleryContentBlockId, blockId));
			}

			if (galleryItems.length > 0) {
				await tx.insert(schema.galleryContentBlockItems).values(galleryItems);
			}
			break;
		}

		case "hero": {
			const heroTitle = block.content?.title;
			if (heroTitle == null) {
				break;
			}

			const heroImageKey = block.content?.imageKey;
			const heroImageId = heroImageKey != null ? await getAssetIdByKey(tx, heroImageKey) : null;
			const eyebrow = block.content?.eyebrow ?? null;
			const ctas = block.content?.ctas ?? null;
			const heroCaption = block.content?.caption ?? null;
			const heroCaptionMode =
				block.content?.captionMode ?? (heroCaption != null ? "override" : "inherit");

			if (isNew) {
				await tx.insert(schema.heroContentBlocks).values({
					id: blockId,
					title: heroTitle,
					eyebrow,
					imageId: heroImageId,
					caption: heroCaption,
					captionMode: heroCaptionMode,
					ctas,
				});
			} else {
				await tx
					.update(schema.heroContentBlocks)
					.set({
						title: heroTitle,
						eyebrow,
						imageId: heroImageId,
						caption: heroCaption,
						captionMode: heroCaptionMode,
						ctas,
					})
					.where(eq(schema.heroContentBlocks.id, blockId));
			}
			break;
		}

		// An accordion is its panels, and a panel is its blocks: both are written by the caller walking
		// the tree, so there is nothing here but the row that makes the block exist. The insert is
		// conditional only because a re-saved block keeps its row.
		case "accordion": {
			if (isNew) {
				await tx.insert(schema.accordionContentBlocks).values({ id: blockId });
			}
			break;
		}

		case "accordion_item": {
			const title = block.content?.title?.trim() ?? "";
			if (isNew) {
				await tx.insert(schema.accordionItemContentBlocks).values({ id: blockId, title });
			} else {
				await tx
					.update(schema.accordionItemContentBlocks)
					.set({ title })
					.where(eq(schema.accordionItemContentBlocks.id, blockId));
			}
			break;
		}

		case "media_text": {
			const imageKey = block.content?.imageKey;
			if (imageKey == null) {
				break;
			}

			const imageId = await getAssetIdByKey(tx, imageKey);
			if (imageId == null) {
				break;
			}

			const side = block.content?.side ?? "start";
			const content = cleanRequiredBody(block.content?.content);
			const caption = block.content?.caption ?? null;
			const captionMode = block.content?.captionMode ?? (caption != null ? "override" : "inherit");

			if (isNew) {
				await tx.insert(schema.mediaTextContentBlocks).values({
					id: blockId,
					imageId,
					side,
					content,
					caption,
					captionMode,
				});
			} else {
				await tx
					.update(schema.mediaTextContentBlocks)
					.set({ imageId, side, content, caption, captionMode })
					.where(eq(schema.mediaTextContentBlocks.id, blockId));
			}
			break;
		}
	}
}

/** A read row before nesting: a block, plus the container it belongs to. */
type FlatContentBlock = ContentBlock & { parentBlockId: string | null };

/**
 * Assembles the flat rows into the tree the editor and the previews read, roots first and each
 * level in `position` order.
 *
 * The queries above fetch a whole field at once — nested blocks carry the same `field_id`, so they
 * arrive in the same result — which is why this is a grouping pass rather than a second round of
 * queries per container.
 *
 * A block whose parent is missing from the set is treated as a root. That cannot happen for a whole
 * field, since a child's parent is by construction in the same field; it is a safeguard for the
 * partial reads (`fieldName`) and for data that predates a rule, and it keeps a block visible and
 * editable rather than silently dropping it.
 */
function nestContentBlocks(flat: Array<FlatContentBlock>): Array<ContentBlock> {
	const byParent = new Map<string, Array<FlatContentBlock>>();
	const ids = new Set(flat.map((block) => String(block.id)));

	for (const block of flat) {
		if (block.parentBlockId == null || !ids.has(block.parentBlockId)) {
			continue;
		}

		const siblings = byParent.get(block.parentBlockId) ?? [];
		siblings.push(block);
		byParent.set(block.parentBlockId, siblings);
	}

	function build(blocks: Array<FlatContentBlock>): Array<ContentBlock> {
		return blocks
			.toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0))
			.map(({ parentBlockId: _parentBlockId, ...block }) => {
				const children = byParent.get(String(block.id));

				return children == null ? block : ({ ...block, children: build(children) } as ContentBlock);
			});
	}

	return build(
		flat.filter((block) => block.parentBlockId == null || !ids.has(block.parentBlockId)),
	);
}

export async function getEntityContentBlocks(
	entityVersionId: string,
	fieldName?: string,
): Promise<Array<ContentBlock>> {
	// Most entity types have a single content-block field; pass fieldName for multi-field types.
	const contentBlocksWhere =
		fieldName != null
			? and(
					eq(schema.fields.entityVersionId, entityVersionId),
					eq(schema.entityTypesFieldsNames.fieldName, fieldName),
				)
			: eq(schema.fields.entityVersionId, entityVersionId);

	const [
		calloutContentBlockRows,
		richTextContentBlocks,
		imageContentBlockRows,
		embedContentBlockRows,
		dataContentBlockRows,
		galleryContentBlockRows,
		heroContentBlockRows,
		accordionContentBlockRows,
		accordionItemContentBlockRows,
		mediaTextContentBlockRows,
	] = await Promise.all([
		db
			.select({
				id: schema.calloutContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				intent: schema.calloutContentBlocks.intent,
				title: schema.calloutContentBlocks.title,
			})
			.from(schema.calloutContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.calloutContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.richTextContentBlocks.id,
				content: sql<JSONContent | undefined>`${schema.richTextContentBlocks.content}`,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
			})
			.from(schema.richTextContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.richTextContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.imageContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				imageKey: schema.assets.key,
				alt: schema.assets.alt,
				assetCaption: schema.assets.caption,
				caption: schema.imageContentBlocks.caption,
				captionMode: schema.imageContentBlocks.captionMode,
				layout: schema.imageContentBlocks.layout,
			})
			.from(schema.imageContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.innerJoin(schema.assets, eq(schema.imageContentBlocks.imageId, schema.assets.id))
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.embedContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				url: schema.embedContentBlocks.url,
				title: schema.embedContentBlocks.title,
				caption: schema.embedContentBlocks.caption,
			})
			.from(schema.embedContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.embedContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.dataContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				dataType: schema.dataContentBlockTypes.type,
				limit: schema.dataContentBlocks.limit,
				selectedIds: schema.dataContentBlocks.selectedIds,
			})
			.from(schema.dataContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.dataContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(
				schema.dataContentBlockTypes,
				eq(schema.dataContentBlocks.typeId, schema.dataContentBlockTypes.id),
			)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.galleryContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				layout: schema.galleryContentBlocks.layout,
				caption: schema.galleryContentBlocks.caption,
				imageKey: schema.assets.key,
				imageId: schema.assets.id,
				imageLabel: schema.assets.label,
				imageAlt: schema.assets.alt,
				imageAssetCaption: schema.assets.caption,
				imageLicenseId: schema.assets.licenseId,
				imageLicenseCode: schema.licenses.code,
				imageLicenseName: schema.licenses.name,
				imageMimeType: schema.assets.mimeType,
				itemCaption: schema.galleryContentBlockItems.caption,
				itemCaptionMode: schema.galleryContentBlockItems.captionMode,
			})
			.from(schema.galleryContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.galleryContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.leftJoin(
				schema.galleryContentBlockItems,
				eq(schema.galleryContentBlocks.id, schema.galleryContentBlockItems.galleryContentBlockId),
			)
			.leftJoin(schema.assets, eq(schema.galleryContentBlockItems.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.assets.licenseId, schema.licenses.id))
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position, schema.galleryContentBlockItems.position),
		db
			.select({
				id: schema.heroContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				title: schema.heroContentBlocks.title,
				eyebrow: schema.heroContentBlocks.eyebrow,
				imageKey: schema.assets.key,
				imageId: schema.assets.id,
				imageLabel: schema.assets.label,
				imageAlt: schema.assets.alt,
				imageAssetCaption: schema.assets.caption,
				imageLicenseId: schema.assets.licenseId,
				imageLicenseCode: schema.licenses.code,
				imageLicenseName: schema.licenses.name,
				imageMimeType: schema.assets.mimeType,
				caption: schema.heroContentBlocks.caption,
				captionMode: schema.heroContentBlocks.captionMode,
				ctas: schema.heroContentBlocks.ctas,
			})
			.from(schema.heroContentBlocks)
			.innerJoin(schema.contentBlocks, eq(schema.heroContentBlocks.id, schema.contentBlocks.id))
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.leftJoin(schema.assets, eq(schema.heroContentBlocks.imageId, schema.assets.id))
			.leftJoin(schema.licenses, eq(schema.assets.licenseId, schema.licenses.id))
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.accordionContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
			})
			.from(schema.accordionContentBlocks)
			.innerJoin(
				schema.contentBlocks,
				eq(schema.accordionContentBlocks.id, schema.contentBlocks.id),
			)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.accordionItemContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				title: schema.accordionItemContentBlocks.title,
			})
			.from(schema.accordionItemContentBlocks)
			.innerJoin(
				schema.contentBlocks,
				eq(schema.accordionItemContentBlocks.id, schema.contentBlocks.id),
			)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.mediaTextContentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				imageKey: schema.assets.key,
				alt: schema.assets.alt,
				assetCaption: schema.assets.caption,
				side: schema.mediaTextContentBlocks.side,
				content: schema.mediaTextContentBlocks.content,
				caption: schema.mediaTextContentBlocks.caption,
				captionMode: schema.mediaTextContentBlocks.captionMode,
			})
			.from(schema.mediaTextContentBlocks)
			.innerJoin(
				schema.contentBlocks,
				eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
			)
			.innerJoin(schema.fields, eq(schema.contentBlocks.fieldId, schema.fields.id))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
			)
			.innerJoin(schema.assets, eq(schema.mediaTextContentBlocks.imageId, schema.assets.id))
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
	]);

	const imageContentBlocks = imageContentBlockRows.map((row) => {
		const { url: imageUrl } = images.generateSignedImageUrl({
			key: row.imageKey,
			options: imageGridOptions,
		});

		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "image" as const,
			content: {
				imageKey: row.imageKey,
				imageUrl,
				alt: row.alt,
				assetCaption: row.assetCaption,
				caption: row.caption,
				captionMode: row.captionMode,
				layout: row.layout,
			},
		};
	});

	const calloutContentBlocks = calloutContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "callout" as const,
			content: {
				intent: row.intent,
				title: row.title ?? undefined,
			},
		};
	});

	const embedContentBlocks = embedContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "embed" as const,
			content: { url: row.url, title: row.title, caption: row.caption ?? undefined },
		};
	});

	const dataContentBlocks = dataContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "data" as const,
			content: {
				dataType: row.dataType,
				limit: row.limit ?? undefined,
				selectedIds: (row.selectedIds as Array<string> | undefined) ?? undefined,
			},
		};
	});

	const galleryContentBlocks = Array.from(
		galleryContentBlockRows
			.reduce((map, row) => {
				const existing = map.get(row.id);

				if (existing == null) {
					map.set(row.id, {
						id: row.id,
						position: row.position,
						parentBlockId: row.parentBlockId,
						type: "gallery" as const,
						content: {
							layout: row.layout,
							caption: row.caption ?? undefined,
							items: [],
						},
					});
				}

				if (row.imageKey != null) {
					const imageUrl = images.generateSignedImageUrl({
						key: row.imageKey,
						options: imageGridOptions,
					}).url;

					map.get(row.id)!.content!.items!.push({
						imageKey: row.imageKey,
						imageUrl,
						asset: toBlockAsset(row, imageUrl),
						caption: row.itemCaption ?? undefined,
						captionMode: row.itemCaptionMode ?? undefined,
					});
				}

				return map;
			}, new Map<string, Extract<FlatContentBlock, { type: "gallery" }>>())
			.values(),
	);

	const heroContentBlocks = heroContentBlockRows.map((row) => {
		const imageUrl =
			row.imageKey != null
				? images.generateSignedImageUrl({ key: row.imageKey, options: imageGridOptions }).url
				: undefined;

		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "hero" as const,
			content: {
				title: row.title,
				eyebrow: row.eyebrow ?? undefined,
				imageKey: row.imageKey ?? undefined,
				imageUrl,
				asset: imageUrl != null ? toBlockAsset(row, imageUrl) : undefined,
				caption: row.caption,
				captionMode: row.captionMode,
				ctas: (row.ctas as Array<{ label: string; url: string }> | undefined) ?? undefined,
			},
		};
	});

	const accordionContentBlocks = accordionContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "accordion" as const,
		};
	});

	const accordionItemContentBlocks = accordionItemContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "accordion_item" as const,
			content: { title: row.title },
		};
	});

	const mediaTextContentBlocks = mediaTextContentBlockRows.map((row) => {
		const { url: imageUrl } = images.generateSignedImageUrl({
			key: row.imageKey,
			options: imageGridOptions,
		});

		return {
			id: row.id,
			position: row.position,
			parentBlockId: row.parentBlockId,
			type: "media_text" as const,
			content: {
				imageKey: row.imageKey,
				imageUrl,
				alt: row.alt,
				assetCaption: row.assetCaption,
				side: row.side,
				content: row.content,
				caption: row.caption,
				captionMode: row.captionMode,
			},
		};
	});

	return nestContentBlocks([
		...calloutContentBlocks,
		...richTextContentBlocks.map((row) => {
			return { ...row, type: "rich_text" as const };
		}),
		...imageContentBlocks,
		...embedContentBlocks,
		...dataContentBlocks,
		...galleryContentBlocks,
		...heroContentBlocks,
		...accordionContentBlocks,
		...accordionItemContentBlocks,
		...mediaTextContentBlocks,
	]);
}

/**
 * Annotates placeholder-value nodes in already-loaded content blocks with their current data (a
 * `value` attribute the renderers format). Use on read-only views (details pages); edit screens
 * must keep the raw nodes so editors see and can remove the reference chips.
 */
export async function resolvePlaceholderValuesInContentBlocks(
	blocks: Array<ContentBlock>,
): Promise<Array<ContentBlock>> {
	const kinds = collectPlaceholderValueKinds(blocks);
	if (kinds.size === 0) {
		return blocks;
	}

	const values = await getPlaceholderValues(db, kinds);

	return annotatePlaceholderValues(blocks, values);
}

/**
 * Names the entity every `entity`-targeted link points at, so a preview can show which page a link
 * leads to rather than only that it leads to one.
 *
 * No href is attached. Turning a document id into a website url means reproducing the per-type
 * routing the public API owns — including the country a consortium is surfaced under, and the
 * author-defined path of a page — and the dashboard preview is not the website. An unresolved id
 * stays unresolved, which is how a reader tells a live reference from one whose target has been
 * deleted or unpublished.
 */
export async function resolveEntityLinksInContentBlocks(
	blocks: Array<ContentBlock>,
): Promise<Array<ContentBlock>> {
	const ids = collectLinkTargetEntityIds(blocks);
	if (ids.size === 0) {
		return blocks;
	}

	const entities = await getEntityRelationOptionsByIds([...ids]);

	const resolved = new Map(
		entities.map((entity) => [entity.id, { label: entity.name, type: entity.entityType }] as const),
	);

	return annotateEntityLinkTargets(blocks, resolved);
}

/**
 * `getEntityContentBlocks` with placeholder-value nodes substituted by their current values, and
 * entity links named. Both are read-only annotations: edit screens load the raw blocks, so authors
 * keep seeing (and can remove) the references themselves.
 */
export async function getResolvedEntityContentBlocks(
	entityVersionId: string,
	fieldName?: string,
): Promise<Array<ContentBlock>> {
	const blocks = await getEntityContentBlocks(entityVersionId, fieldName);

	return resolveEntityLinksInContentBlocks(await resolvePlaceholderValuesInContentBlocks(blocks));
}
