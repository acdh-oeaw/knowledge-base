import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";

import type { ContentBlock } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/content-blocks";
import { imageGridOptions } from "@/config/assets.config";
import type { ContentBlockInput } from "@/lib/content-block-input";
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

async function createGalleryItems(
	tx: Transaction,
	blockId: string,
	items: Array<{ imageKey?: string; imageUrl?: string; caption?: string }> = [],
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
			};

			return galleryItem;
		}),
	);

	return galleryItems.filter((item): item is schema.GalleryContentBlockItemInput => item != null);
}

export async function upsertTypedContentBlock(
	tx: Transaction,
	block: ContentBlockInput,
	blockId: string,
	isNew: boolean,
): Promise<void> {
	switch (block.type) {
		case "rich_text": {
			if (isNew) {
				await tx
					.insert(schema.richTextContentBlocks)
					.values({ id: blockId, content: block.content ?? {} });
			} else {
				await tx
					.update(schema.richTextContentBlocks)
					.set({ content: block.content ?? {} })
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

			if (isNew) {
				await tx.insert(schema.imageContentBlocks).values({
					id: blockId,
					imageId,
					caption,
				});
			} else {
				await tx
					.update(schema.imageContentBlocks)
					.set({ imageId, caption })
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
			const galleryItems = await createGalleryItems(tx, blockId, block.content?.items);

			if (isNew) {
				await tx.insert(schema.galleryContentBlocks).values({ id: blockId, layout });
			} else {
				await tx
					.update(schema.galleryContentBlocks)
					.set({ layout })
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

			if (isNew) {
				await tx.insert(schema.heroContentBlocks).values({
					id: blockId,
					title: heroTitle,
					eyebrow,
					imageId: heroImageId,
					ctas,
				});
			} else {
				await tx
					.update(schema.heroContentBlocks)
					.set({ title: heroTitle, eyebrow, imageId: heroImageId, ctas })
					.where(eq(schema.heroContentBlocks.id, blockId));
			}
			break;
		}

		case "accordion": {
			const items = block.content?.items ?? [];
			if (isNew) {
				await tx.insert(schema.accordionContentBlocks).values({ id: blockId, items });
			} else {
				await tx
					.update(schema.accordionContentBlocks)
					.set({ items })
					.where(eq(schema.accordionContentBlocks.id, blockId));
			}
			break;
		}
	}
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
		richTextContentBlocks,
		imageContentBlockRows,
		embedContentBlockRows,
		dataContentBlockRows,
		galleryContentBlockRows,
		heroContentBlockRows,
		accordionContentBlockRows,
	] = await Promise.all([
		db
			.select({
				id: schema.richTextContentBlocks.id,
				content: sql<JSONContent | undefined>`${schema.richTextContentBlocks.content}`,
				position: schema.contentBlocks.position,
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
				imageKey: schema.assets.key,
				caption: schema.imageContentBlocks.caption,
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
				layout: schema.galleryContentBlocks.layout,
				imageKey: schema.assets.key,
				itemCaption: schema.galleryContentBlockItems.caption,
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
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position, schema.galleryContentBlockItems.position),
		db
			.select({
				id: schema.heroContentBlocks.id,
				position: schema.contentBlocks.position,
				title: schema.heroContentBlocks.title,
				eyebrow: schema.heroContentBlocks.eyebrow,
				imageKey: schema.assets.key,
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
			.where(contentBlocksWhere)
			.orderBy(schema.contentBlocks.position),
		db
			.select({
				id: schema.accordionContentBlocks.id,
				position: schema.contentBlocks.position,
				items: schema.accordionContentBlocks.items,
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
	]);

	const imageContentBlocks = imageContentBlockRows.map((row) => {
		const { url: imageUrl } = images.generateSignedImageUrl({
			key: row.imageKey,
			options: imageGridOptions,
		});

		return {
			id: row.id,
			position: row.position,
			type: "image" as const,
			content: { imageKey: row.imageKey, imageUrl, caption: row.caption ?? undefined },
		};
	});

	const embedContentBlocks = embedContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			type: "embed" as const,
			content: { url: row.url, title: row.title, caption: row.caption ?? undefined },
		};
	});

	const dataContentBlocks = dataContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
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
						type: "gallery" as const,
						content: {
							layout: row.layout,
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
						caption: row.itemCaption ?? undefined,
					});
				}

				return map;
			}, new Map<string, Extract<ContentBlock, { type: "gallery" }>>())
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
			type: "hero" as const,
			content: {
				title: row.title,
				eyebrow: row.eyebrow ?? undefined,
				imageKey: row.imageKey ?? undefined,
				imageUrl,
				ctas: (row.ctas as Array<{ label: string; url: string }> | undefined) ?? undefined,
			},
		};
	});

	const accordionContentBlocks = accordionContentBlockRows.map((row) => {
		return {
			id: row.id,
			position: row.position,
			type: "accordion" as const,
			content: {
				items: row.items as Array<{ title: string; content?: JSONContent }> | undefined,
			},
		};
	});

	return [
		...richTextContentBlocks.map((row) => {
			return { ...row, type: "rich_text" as const };
		}),
		...imageContentBlocks,
		...embedContentBlocks,
		...dataContentBlocks,
		...galleryContentBlocks,
		...heroContentBlocks,
		...accordionContentBlocks,
	].toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0));
}
