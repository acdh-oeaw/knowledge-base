import { type ImageCaptionMode, resolveImageCaption } from "@dariah-eric/database/image-captions";
import {
	annotateEntityLinkTargets,
	annotateLinkTargets,
	collectLinkTargetAssetKeys,
	collectLinkTargetEntityIds,
} from "@dariah-eric/database/link-targets";
import { getLinkTargetAssets } from "@dariah-eric/database/link-targets-service";
import {
	annotatePlaceholderValues,
	collectPlaceholderValueKinds,
} from "@dariah-eric/database/placeholder-values";
import { getPlaceholderValues } from "@dariah-eric/database/placeholder-values-service";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import * as v from "valibot";

import { getAssetDownloadUrl, getDownloadFilename } from "@/lib/asset-download";
import { getEmbedUrl } from "@/lib/embed-url";
import { generateImageUrl, toImageAsset } from "@/lib/images";
import { getEntityRefsByDocumentId } from "@/lib/relations";
import { LicenseSchema } from "@/lib/schemas";
import type { Database, Transaction } from "@/middlewares/db";
import { alias, eq, inArray } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

export const RichTextContentBlockSchema = v.object({
	type: v.literal("rich_text"),
	content: v.pipe(
		v.any(),
		// Every other node maps onto one element, so it needs no explanation here. A footnote does not:
		// rendering it takes assembling something the payload does not spell out.
		v.description(
			"Richtext as Tiptap JSON. The inline `footnote` node is a marker carrying its own note in `attrs.content` (richtext of the same shape): it holds no number, so a renderer numbers the markers by their order across all of an item's content blocks and lists the notes, in that order, at the end of the item.",
		),
	),
});

export const EmbedContentBlockSchema = v.object({
	type: v.literal("embed"),
	/** The URL as entered by the editor. */
	url: v.string(),
	/** `url` normalised to a `youtube-nocookie.com` embed URL, ready for an `<iframe src>`. */
	embedUrl: v.string(),
	caption: v.nullable(v.any()),
});

export const ImageContentBlockSchema = v.object({
	type: v.literal("image"),
	image: v.object({
		url: v.string(),
		alt: v.nullable(v.string()),
		license: v.nullable(LicenseSchema),
	}),
	caption: v.nullable(v.any()),
	captionSource: v.nullable(v.picklist(["asset", "block"])),
	layout: v.picklist(schema.imageLayoutEnum),
});

export const DataContentBlockSchema = v.object({
	type: v.literal("data"),
	dataType: v.picklist(schema.dataContentBlockTypesEnum),
	limit: v.nullable(v.number()),
});

export const HeroContentBlockSchema = v.object({
	type: v.literal("hero"),
	title: v.string(),
	eyebrow: v.nullable(v.string()),
	image: v.nullable(
		v.object({
			url: v.string(),
			alt: v.nullable(v.string()),
			license: v.nullable(LicenseSchema),
		}),
	),
	caption: v.nullable(v.any()),
	captionSource: v.nullable(v.picklist(["asset", "block"])),
	ctas: v.nullable(v.array(v.object({ label: v.string(), url: v.string() }))),
});

export const MediaTextContentBlockSchema = v.object({
	type: v.literal("media_text"),
	image: v.object({
		url: v.string(),
		alt: v.nullable(v.string()),
		license: v.nullable(LicenseSchema),
	}),
	side: v.picklist(schema.mediaTextSideEnum),
	content: v.any(),
	caption: v.nullable(v.any()),
	captionSource: v.nullable(v.picklist(["asset", "block"])),
});

export const GalleryContentBlockSchema = v.object({
	type: v.literal("gallery"),
	layout: v.picklist(schema.galleryLayoutEnum),
	/** The gallery's caption, describing the set. Each item carries its own image's caption. */
	caption: v.nullable(v.any()),
	items: v.array(
		v.object({
			image: v.object({
				url: v.string(),
				alt: v.nullable(v.string()),
				license: v.nullable(LicenseSchema),
			}),
			caption: v.nullable(v.any()),
			captionSource: v.nullable(v.picklist(["asset", "block"])),
		}),
	),
});

/**
 * The blocks a container may hold. A finite list rather than a recursive reference to the union
 * below, because the nesting rules make it finite: a callout and an accordion panel hold flow
 * content, and no container holds another (see `allowedChildBlockTypes` in
 * `@dariah-eric/database`).
 */
export const NestedContentBlockSchema = v.union([
	RichTextContentBlockSchema,
	ImageContentBlockSchema,
	EmbedContentBlockSchema,
	GalleryContentBlockSchema,
	MediaTextContentBlockSchema,
]);

export const CalloutContentBlockSchema = v.object({
	type: v.literal("callout"),
	intent: v.picklist(schema.calloutIntentsEnum),
	title: v.nullable(v.string()),
	/**
	 * The callout's body, as blocks. An image here is an `image` block exactly like one in the page
	 * itself — same resolved url, alt text and licence — rather than a node a consumer would have to
	 * resolve on its own.
	 */
	blocks: v.array(NestedContentBlockSchema),
});

export const AccordionContentBlockSchema = v.object({
	type: v.literal("accordion"),
	items: v.array(
		v.object({
			title: v.string(),
			/** The panel's body, as blocks — see {@link CalloutContentBlockSchema}'s `blocks`. */
			blocks: v.array(NestedContentBlockSchema),
		}),
	),
});

export const ContentBlockSchema = v.union([
	RichTextContentBlockSchema,
	CalloutContentBlockSchema,
	EmbedContentBlockSchema,
	ImageContentBlockSchema,
	DataContentBlockSchema,
	HeroContentBlockSchema,
	AccordionContentBlockSchema,
	MediaTextContentBlockSchema,
	GalleryContentBlockSchema,
]);

export type ContentBlock = v.InferOutput<typeof ContentBlockSchema>;

export type NestedContentBlock = v.InferOutput<typeof NestedContentBlockSchema>;

/**
 * An accordion panel as it comes out of the query, before it is folded into its accordion's
 * `items`. Never part of the payload: a panel is a block in the database because that is what lets
 * it hold blocks, but a consumer only ever sees the accordion.
 */
interface AccordionItemRow {
	type: "accordion_item";
}

type NormalizedBlock = ContentBlock | AccordionItemRow;

type GalleryContentBlock = Extract<ContentBlock, { type: "gallery" }>;
type GalleryItem = GalleryContentBlock["items"][number];

const heroAssets = alias(schema.assets, "hero_assets");
const heroLicenses = alias(schema.licenses, "hero_licenses");
const mediaTextAssets = alias(schema.assets, "media_text_assets");
const mediaTextLicenses = alias(schema.licenses, "media_text_licenses");
const galleryAssets = alias(schema.assets, "gallery_assets");
const galleryLicenses = alias(schema.licenses, "gallery_licenses");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function getContentBlocks(db: Database | Transaction, entityId: string) {
	const rows = await db
		.select({
			fieldId: schema.fields.id,
			fieldName: schema.entityTypesFieldsNames.fieldName,
			blockId: schema.contentBlocks.id,
			blockType: schema.contentBlockTypes.type,
			parentBlockId: schema.contentBlocks.parentBlockId,
			calloutIntent: schema.calloutContentBlocks.intent,
			calloutTitle: schema.calloutContentBlocks.title,
			richTextContent: schema.richTextContentBlocks.content,
			embedUrl: schema.embedContentBlocks.url,
			embedCaption: schema.embedContentBlocks.caption,
			imageCaption: schema.imageContentBlocks.caption,
			imageCaptionMode: schema.imageContentBlocks.captionMode,
			imageLayout: schema.imageContentBlocks.layout,
			imageKey: schema.assets.key,
			imageWidth: schema.assets.width,
			imageHeight: schema.assets.height,
			imageAlt: schema.assets.alt,
			imageAssetCaption: schema.assets.caption,
			imageLicenseName: schema.licenses.name,
			imageLicenseUrl: schema.licenses.url,
			dataLimit: schema.dataContentBlocks.limit,
			dataType: schema.dataContentBlockTypes.type,
			heroTitle: schema.heroContentBlocks.title,
			heroEyebrow: schema.heroContentBlocks.eyebrow,
			heroImageKey: heroAssets.key,
			heroImageWidth: heroAssets.width,
			heroImageHeight: heroAssets.height,
			heroImageAlt: heroAssets.alt,
			heroImageCaption: heroAssets.caption,
			heroLicenseName: heroLicenses.name,
			heroLicenseUrl: heroLicenses.url,
			heroCaption: schema.heroContentBlocks.caption,
			heroCaptionMode: schema.heroContentBlocks.captionMode,
			heroCtas: schema.heroContentBlocks.ctas,
			accordionItemTitle: schema.accordionItemContentBlocks.title,
			mediaTextSide: schema.mediaTextContentBlocks.side,
			mediaTextContent: schema.mediaTextContentBlocks.content,
			mediaTextCaption: schema.mediaTextContentBlocks.caption,
			mediaTextCaptionMode: schema.mediaTextContentBlocks.captionMode,
			mediaTextImageKey: mediaTextAssets.key,
			mediaTextImageWidth: mediaTextAssets.width,
			mediaTextImageHeight: mediaTextAssets.height,
			mediaTextImageAlt: mediaTextAssets.alt,
			mediaTextImageCaption: mediaTextAssets.caption,
			mediaTextLicenseName: mediaTextLicenses.name,
			mediaTextLicenseUrl: mediaTextLicenses.url,
			galleryLayout: schema.galleryContentBlocks.layout,
			galleryCaption: schema.galleryContentBlocks.caption,
		})
		.from(schema.fields)
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(
			schema.contentBlockTypes,
			eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
		)
		.leftJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(
			schema.calloutContentBlocks,
			eq(schema.calloutContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(schema.embedContentBlocks, eq(schema.embedContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(schema.imageContentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(schema.assets, eq(schema.assets.id, schema.imageContentBlocks.imageId))
		.leftJoin(schema.licenses, eq(schema.licenses.id, schema.assets.licenseId))
		.leftJoin(schema.dataContentBlocks, eq(schema.dataContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(
			schema.dataContentBlockTypes,
			eq(schema.dataContentBlockTypes.id, schema.dataContentBlocks.typeId),
		)
		.leftJoin(schema.heroContentBlocks, eq(schema.heroContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(heroAssets, eq(heroAssets.id, schema.heroContentBlocks.imageId))
		.leftJoin(heroLicenses, eq(heroLicenses.id, heroAssets.licenseId))
		.leftJoin(
			schema.accordionContentBlocks,
			eq(schema.accordionContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(
			schema.accordionItemContentBlocks,
			eq(schema.accordionItemContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(
			schema.mediaTextContentBlocks,
			eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(mediaTextAssets, eq(mediaTextAssets.id, schema.mediaTextContentBlocks.imageId))
		.leftJoin(mediaTextLicenses, eq(mediaTextLicenses.id, mediaTextAssets.licenseId))
		// Only the gallery's own row joins here. Its items are one-to-many, so joining them would
		// multiply every other block's row; they are fetched in one follow-up query below instead.
		.leftJoin(
			schema.galleryContentBlocks,
			eq(schema.galleryContentBlocks.id, schema.contentBlocks.id),
		)
		.where(eq(schema.fields.entityVersionId, entityId))
		.orderBy(schema.contentBlocks.position);

	// Group rows by field, preserving position order (already sorted by ORDER BY)
	const fieldMap = new Map<string, { name: string; blocks: Array<ContentBlock> }>();
	const galleryBlocks = new Map<string, GalleryContentBlock>();
	// Every block by id, and the ids of the children each one owns — the two things the nesting pass
	// below needs. Rows arrive in `position` order, and a container's children carry the same
	// `field_id`, so a child is always in this same result and always after its siblings.
	const blocksById = new Map<string, NormalizedBlock>();
	const childIdsByParent = new Map<string, Array<string>>();
	const accordionItemTitles = new Map<string, string>();

	for (const row of rows) {
		if (!fieldMap.has(row.fieldId)) {
			fieldMap.set(row.fieldId, { name: row.fieldName, blocks: [] });
		}

		const block = normalizeRow(row);
		if (block.type === "gallery") {
			galleryBlocks.set(row.blockId, block);
		}

		blocksById.set(row.blockId, block);

		if (row.blockType === "accordion_item") {
			accordionItemTitles.set(row.blockId, row.accordionItemTitle ?? "");
		}

		if (row.parentBlockId != null) {
			const siblings = childIdsByParent.get(row.parentBlockId) ?? [];
			siblings.push(row.blockId);
			childIdsByParent.set(row.parentBlockId, siblings);
			continue;
		}

		// A panel with no accordion is not something the payload can express; it is dropped rather than
		// surfaced as a block of its own. Cannot happen for a well-formed field.
		if (block.type !== "accordion_item") {
			fieldMap.get(row.fieldId)!.blocks.push(block);
		}
	}

	// Filled in before the annotation passes below, so an item's caption gets the same link and
	// placeholder resolution as any other rich text.
	if (galleryBlocks.size > 0) {
		const itemsByBlock = await getGalleryItems(db, [...galleryBlocks.keys()]);
		for (const [blockId, block] of galleryBlocks) {
			block.items = itemsByBlock.get(blockId) ?? [];
		}
	}

	// Children are attached after the gallery items above, so a gallery nested in a callout arrives
	// with its items already in place.
	for (const [parentId, childIds] of childIdsByParent) {
		const parent = blocksById.get(parentId);
		if (parent == null) {
			continue;
		}

		if (parent.type === "callout") {
			parent.blocks = childIds.flatMap((childId) => {
				const child = blocksById.get(childId);
				return child == null ? [] : [child as NestedContentBlock];
			});
			continue;
		}

		if (parent.type === "accordion") {
			parent.items = childIds.flatMap((childId) => {
				const item = blocksById.get(childId);
				if (item?.type !== "accordion_item") {
					return [];
				}

				const blocks = (childIdsByParent.get(childId) ?? []).flatMap((grandChildId) => {
					const child = blocksById.get(grandChildId);
					return child == null ? [] : [child as NestedContentBlock];
				});

				return [{ title: accordionItemTitles.get(childId) ?? "", blocks }];
			});
		}
	}

	const fields = Object.fromEntries(
		[...fieldMap.values()].map(({ name, blocks }) => [name, blocks]),
	);

	// Both passes below resolve references the editor stored deliberately, so that nothing derived —
	// a count, a download url — is ever frozen into the document at authoring time.

	// Placeholder-value nodes are stored as references; attach the current data here (a `value`
	// attribute: number for counts, name array for lists) so consumers render it themselves.
	const placeholderValueKinds = collectPlaceholderValueKinds(fields);
	const withPlaceholderValues =
		placeholderValueKinds.size === 0
			? fields
			: annotatePlaceholderValues(fields, await getPlaceholderValues(db, placeholderValueKinds));

	// Asset-targeted links store only the asset's storage key; attach the download url, filename and
	// size so consumers can render the link (and any file chrome) without knowing our storage layout.
	const withAssetLinks = await annotateAssetLinks(db, withPlaceholderValues);

	// Entity-targeted links store only a document id; attach the page it currently lives at, so a
	// renamed slug moves every link to it.
	return annotateEntityLinks(db, withAssetLinks);
}

/**
 * Every gallery's items, in item order, keyed by gallery block id.
 *
 * Items are rendered side by side rather than across the content column, so they are signed at
 * `preview` width like a floated image — not the `featured` width a standalone image gets.
 */
async function getGalleryItems(
	db: Database | Transaction,
	blockIds: Array<string>,
): Promise<Map<string, Array<GalleryItem>>> {
	const rows = await db
		.select({
			blockId: schema.galleryContentBlockItems.galleryContentBlockId,
			caption: schema.galleryContentBlockItems.caption,
			captionMode: schema.galleryContentBlockItems.captionMode,
			imageKey: galleryAssets.key,
			imageWidth: galleryAssets.width,
			imageHeight: galleryAssets.height,
			imageAlt: galleryAssets.alt,
			imageAssetCaption: galleryAssets.caption,
			licenseName: galleryLicenses.name,
			licenseUrl: galleryLicenses.url,
		})
		.from(schema.galleryContentBlockItems)
		.innerJoin(galleryAssets, eq(galleryAssets.id, schema.galleryContentBlockItems.imageId))
		.leftJoin(galleryLicenses, eq(galleryLicenses.id, galleryAssets.licenseId))
		.where(inArray(schema.galleryContentBlockItems.galleryContentBlockId, blockIds))
		.orderBy(
			schema.galleryContentBlockItems.galleryContentBlockId,
			schema.galleryContentBlockItems.position,
		);

	const itemsByBlock = new Map<string, Array<GalleryItem>>();

	for (const row of rows) {
		const assetImage = generateImageUrl(
			toImageAsset({
				key: row.imageKey,
				alt: row.imageAlt,
				caption: row.imageAssetCaption,
				width: row.imageWidth,
				height: row.imageHeight,
				licenseName: row.licenseName,
				licenseUrl: row.licenseUrl,
			}),
			imageWidth.preview,
		);
		// The caption is resolved for the placement, so it is reported once next to the item rather
		// than a second time inside the image — matching how `image` and `hero` report theirs.
		const { caption: _assetCaption, ...image } = assetImage;
		const { caption, source: captionSource } = resolveImageCaption({
			assetCaption: row.imageAssetCaption,
			blockCaption: row.caption,
			captionMode: row.captionMode,
		});

		const items = itemsByBlock.get(row.blockId) ?? [];
		items.push({ image, caption, captionSource });
		itemsByBlock.set(row.blockId, items);
	}

	return itemsByBlock;
}

/**
 * Resolves `entity`-targeted link marks. Unpublished, deleted and page-less entities all resolve to
 * nothing and stay unannotated, so a renderer sees one "no href" case rather than three.
 */
async function annotateEntityLinks<T>(db: Database | Transaction, value: T): Promise<T> {
	const ids = collectLinkTargetEntityIds(value);
	if (ids.size === 0) {
		return value;
	}

	const refs = await getEntityRefsByDocumentId(db, [...ids]);

	const resolved = new Map(
		[...refs]
			.filter(([, ref]) => ref.href != null)
			.map(([id, ref]) => [id, { href: ref.href!, label: ref.label, type: ref.type }] as const),
	);

	return annotateEntityLinkTargets(value, resolved);
}

/**
 * Resolves `asset`-targeted link marks anywhere in the given structure. A key whose asset has been
 * deleted stays unresolved — the link keeps no href, and renderers degrade to plain text rather
 * than emitting a dead download.
 */
async function annotateAssetLinks<T>(db: Database | Transaction, value: T): Promise<T> {
	const keys = collectLinkTargetAssetKeys(value);
	if (keys.size === 0) {
		return value;
	}

	const assets = await getLinkTargetAssets(db, keys);

	const resolved = new Map(
		[...assets].map(
			([key, asset]) =>
				[
					key,
					{
						url: getAssetDownloadUrl(key),
						filename: getDownloadFilename(asset),
						mimeType: asset.mimeType,
						size: asset.size,
					},
				] as const,
		),
	);

	return annotateLinkTargets(value, resolved);
}

function normalizeRow(row: {
	blockType: string;
	calloutIntent: (typeof schema.calloutIntentsEnum)[number] | null;
	calloutTitle: string | null;
	richTextContent: unknown;
	embedUrl: string | null;
	embedCaption: JSONContent | null;
	imageCaption: JSONContent | null;
	imageCaptionMode: ImageCaptionMode | null;
	imageLayout: (typeof schema.imageLayoutEnum)[number] | null;
	imageKey: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
	imageAlt: string | null;
	imageAssetCaption: JSONContent | null;
	imageLicenseName: string | null;
	imageLicenseUrl: string | null;
	dataLimit: number | null;
	dataType: string | null;
	heroTitle: string | null;
	heroEyebrow: string | null;
	heroImageKey: string | null;
	heroImageWidth: number | null;
	heroImageHeight: number | null;
	heroImageAlt: string | null;
	heroImageCaption: JSONContent | null;
	heroCaption: JSONContent | null;
	heroCaptionMode: ImageCaptionMode | null;
	heroLicenseName: string | null;
	heroLicenseUrl: string | null;
	heroCtas: unknown;
	accordionItemTitle: string | null;
	mediaTextSide: (typeof schema.mediaTextSideEnum)[number] | null;
	mediaTextContent: JSONContent | null;
	mediaTextCaption: JSONContent | null;
	mediaTextCaptionMode: ImageCaptionMode | null;
	mediaTextImageKey: string | null;
	mediaTextImageWidth: number | null;
	mediaTextImageHeight: number | null;
	mediaTextImageAlt: string | null;
	mediaTextImageCaption: JSONContent | null;
	mediaTextLicenseName: string | null;
	mediaTextLicenseUrl: string | null;
	galleryLayout: (typeof schema.galleryLayoutEnum)[number] | null;
	galleryCaption: JSONContent | null;
}): NormalizedBlock {
	switch (row.blockType) {
		case "callout": {
			// `blocks` is filled in by the nesting pass, once the children this block owns are known.
			return {
				type: "callout",
				intent: row.calloutIntent!,
				title: row.calloutTitle,
				blocks: [],
			};
		}
		case "rich_text": {
			return { type: "rich_text", content: row.richTextContent };
		}
		case "embed": {
			return {
				type: "embed",
				url: row.embedUrl!,
				embedUrl: getEmbedUrl(row.embedUrl!),
				caption: row.embedCaption,
			};
		}
		case "image": {
			const layout = row.imageLayout ?? "default";
			// Floated images render at a constrained width; centred layouts (default/wide/full) keep
			// the full featured width so a breakout image stays sharp.
			const isFloated = layout === "float-start" || layout === "float-end";
			const assetImage = generateImageUrl(
				toImageAsset({
					key: row.imageKey!,
					alt: row.imageAlt,
					caption: row.imageAssetCaption,
					width: row.imageWidth,
					height: row.imageHeight,
					licenseName: row.imageLicenseName,
					licenseUrl: row.imageLicenseUrl,
				}),
				isFloated ? imageWidth.preview : imageWidth.featured,
			);
			const { caption: _assetCaption, ...image } = assetImage;
			const captionMode =
				row.imageCaptionMode ?? (row.imageCaption != null ? "override" : "inherit");
			const { caption, source: captionSource } = resolveImageCaption({
				assetCaption: row.imageAssetCaption,
				blockCaption: row.imageCaption,
				captionMode,
			});

			return {
				type: "image",
				image,
				caption,
				captionSource,
				layout,
			};
		}
		case "data": {
			return {
				type: "data",
				dataType: row.dataType as (typeof schema.dataContentBlockTypesEnum)[number],
				limit: row.dataLimit,
			};
		}
		case "hero": {
			const assetImage = generateImageUrl(
				toImageAsset({
					key: row.heroImageKey,
					alt: row.heroImageAlt,
					caption: row.heroImageCaption,
					width: row.heroImageWidth,
					height: row.heroImageHeight,
					licenseName: row.heroLicenseName,
					licenseUrl: row.heroLicenseUrl,
				}),
				imageWidth.featured,
			);
			/* The caption is resolved for the placement, so it is reported once next to the block
			   rather than a second time inside the image. */
			const image =
				assetImage != null ? (({ caption: _assetCaption, ...rest }) => rest)(assetImage) : null;
			const captionMode = row.heroCaptionMode ?? (row.heroCaption != null ? "override" : "inherit");
			const { caption, source: captionSource } = resolveImageCaption({
				assetCaption: row.heroImageCaption,
				blockCaption: row.heroCaption,
				captionMode,
			});

			return {
				type: "hero",
				title: row.heroTitle!,
				eyebrow: row.heroEyebrow,
				image,
				caption,
				captionSource,
				ctas: row.heroCtas as Array<{ label: string; url: string }> | null,
			};
		}
		// Panels are its children, attached by the nesting pass.
		case "accordion": {
			return { type: "accordion", items: [] };
		}
		// Folded into its accordion's `items` by that same pass; never reaches the payload.
		case "accordion_item": {
			return { type: "accordion_item" };
		}
		case "media_text": {
			const assetImage = generateImageUrl(
				toImageAsset({
					key: row.mediaTextImageKey!,
					alt: row.mediaTextImageAlt,
					caption: row.mediaTextImageCaption,
					width: row.mediaTextImageWidth,
					height: row.mediaTextImageHeight,
					licenseName: row.mediaTextLicenseName,
					licenseUrl: row.mediaTextLicenseUrl,
				}),
				imageWidth.avatar,
			);
			const { caption: _assetCaption, ...image } = assetImage;
			const captionMode =
				row.mediaTextCaptionMode ?? (row.mediaTextCaption != null ? "override" : "inherit");
			const { caption, source: captionSource } = resolveImageCaption({
				assetCaption: row.mediaTextImageCaption,
				blockCaption: row.mediaTextCaption,
				captionMode,
			});

			return {
				type: "media_text",
				image,
				side: row.mediaTextSide!,
				content: row.mediaTextContent,
				caption,
				captionSource,
			};
		}
		case "gallery": {
			// Items are attached by `getGalleryItems` once every block is known, so one query serves the
			// whole entity rather than one per gallery.
			return {
				type: "gallery",
				layout: row.galleryLayout ?? "grid",
				caption: row.galleryCaption,
				items: [],
			};
		}
		default: {
			throw new Error(`Unknown content block type: ${row.blockType}`);
		}
	}
}
