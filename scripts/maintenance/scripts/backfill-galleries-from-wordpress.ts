import * as path from "node:path";

import { assert, createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { type Transaction, createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, inArray } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Regroups the image content blocks that a WordPress gallery was flattened into back into a single
 * `gallery` block. Dry run by default; `--apply` writes the changes.
 *
 * The migration (`@dariah-eric/migrate`) never learned the gallery markup: `migrateHtmlContent`
 * recognises iframes and Easy Accordions, and everything else goes through the TipTap parse, where
 * a `figure.wp-block-gallery` unwraps into its bare `<img>`s. Each of those became its own `image`
 * content block, so a two-image gallery reads as two consecutive full-width images. Nothing was
 * lost — the assets are stored and later backfills restored their captions — only the grouping,
 * which is why this script regroups rather than re-imports.
 *
 * Runs are matched, not guessed at. A gallery's images are matched against the version's blocks as
 * a _consecutive run_ of `image` blocks whose asset labels are that gallery's `src` urls in order —
 * `assets.label` holds the migration's source url verbatim, and
 * `data:backfill:full-resolution-images` swaps the stored object without rewriting the label, so it
 * stays a stable key. A gallery that does not match exactly one run is reported and skipped, never
 * approximated: that is how an item edited on WordPress since the import surfaces as something for
 * a human to look at.
 *
 * Idempotent for the same reason the table backfill is: a regrouped gallery leaves no run of
 * `image` blocks behind to match, so a second run is a no-op without needing a marker column.
 *
 * A touched field has every one of its block positions rewritten to `0…n-1`. Positions only ever
 * order blocks, and earlier cleanups left gaps in the numbering (a field reading `0, 1, 3, 5, 7, 8`
 * is normal), so closing them changes no ordering — it just avoids inventing a fractional slot for
 * the new block. Fields with no matched gallery are not touched at all.
 *
 * Two deliberate limits:
 *
 * - Single-image "galleries" are skipped. WordPress lets you make one, but an image on its own is an
 *   `image` block; wrapping it in a gallery would be a downgrade (it loses `layout`).
 * - `columns-N` is not carried over. The block models `layout` as `grid | carousel` only, with the
 *   column count left to the renderer, so every gallery lands as `grid` and the source's column
 *   count goes to the report for reference rather than into the database.
 *
 * Item captions are taken from the stored `image` blocks rather than re-parsed from WordPress, so
 * the caption backfills' work — and any subsequent editorial fix — carries over untouched. Where
 * WordPress has a `<figcaption>` but the stored block has no caption, the report says so.
 *
 * Galleries whose captions were never folded into their image blocks are the known gap. The
 * migration parsed each `<figcaption>` into its own paragraph, so those galleries are stored as
 * image/caption/image/caption rather than a run of adjacent images, and the strict run match does
 * not find them. They are reported as `captions-not-folded-in` rather than regrouped, because the
 * closing caption paragraph is routinely concatenated with the prose that followed the gallery —
 * consuming it whole would delete real content, and splitting it would be a guess. Handle those few
 * by hand, or fold their captions in first and re-run.
 *
 * @example
 * 	pnpm run data:backfill:galleries-from-wordpress
 * 	pnpm run data:backfill:galleries-from-wordpress -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "galleries-from-wordpress.tsv");

/** The galleries this script refuses to guess at, with why — the ones that need a human. */
const skippedReportFilePath = path.join(cacheFolderPath, "galleries-from-wordpress-skipped.tsv");

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

interface WordPressItem {
	slug: string;
	link: string;
	content: { rendered: string };
}

/**
 * Same `X-WP-TotalPages` pagination contract as the migration's `getAll`, kept local to avoid a
 * cross-package dependency on `@dariah-eric/migrate` for one header-driven loop.
 */
async function fetchAll(
	apiBaseUrl: string,
	resource: "pages" | "posts",
): Promise<Array<WordPressItem>> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: `/wp-json/wp/v2/${resource}`,
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	const results: Array<WordPressItem> = [];

	const response = await fetch(url);
	results.push(...((await response.json()) as Array<WordPressItem>));

	const pages = Number(response.headers.get("X-WP-TotalPages") ?? 1);

	for (let page = 2; page <= pages; page++) {
		url.searchParams.set("page", String(page));
		const pageResponse = await fetch(url);
		results.push(...((await pageResponse.json()) as Array<WordPressItem>));
	}

	return results;
}

/** Mirrors `normalizeWordPressSlug` from `@dariah-eric/migrate`: decode, then slugify. */
function normalizeWordPressSlug(rawSlug: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(rawSlug);
	} catch {
		decoded = rawSlug;
	}
	return slugify(decoded);
}

type EntityType = (typeof schema.entityTypesEnum)[number];

/**
 * Mirrors `getPageEntityType` from `@dariah-eric/migrate`: a WordPress page's entity type is
 * decided by where it sits in the site's URL tree.
 */
function getPageEntityType(pageLink: string): EntityType {
	if (pageLink.startsWith("https://www.dariah.eu/activities/impact-case-studies/")) {
		return "impact_case_studies";
	}

	if (pageLink.startsWith("https://www.dariah.eu/activities/spotlight/")) {
		return "spotlight_articles";
	}

	return "pages";
}

/**
 * Mirrors `normaliseImageUrl` from `data:backfill:full-resolution-images`: host without `www.` plus
 * the decoded pathname, so the same upload is one key however its url was written.
 */
function normaliseImageUrl(value: string): string {
	try {
		const url = new URL(value);
		return `${url.host.replace(/^www\./, "")}${decodeURIComponent(url.pathname)}`;
	} catch {
		return value;
	}
}

/** Returns the index just past the `</figure>` closing the figure whose content starts at `after`. */
function findClosingFigure(html: string, after: number): number {
	let depth = 1;
	let i = after;
	while (i < html.length && depth > 0) {
		const nextOpen = html.indexOf("<figure", i);
		const nextClose = html.indexOf("</figure>", i);
		if (nextClose === -1) {
			break;
		}
		if (nextOpen !== -1 && nextOpen < nextClose) {
			depth++;
			i = nextOpen + 7;
		} else {
			depth--;
			i = nextClose + 9;
		}
	}
	return i;
}

interface GalleryItemSource {
	src: string;
	/** Whether WordPress shows a caption for this item — reported, never written. */
	hasCaption: boolean;
}

/**
 * The gallery's images in document order. Each image sits in its own `<figure>` in both the legacy
 * `ul.blocks-gallery-grid` markup and the current nested-`wp-block-image` markup, so keying off the
 * `<img>` and looking ahead to its figure's `<figcaption>` reads either without a format switch.
 */
function extractGalleryItems(innerHtml: string): Array<GalleryItemSource> {
	const items: Array<GalleryItemSource> = [];
	const imageRe = /<img\b[^>]*>/gi;

	let match: RegExpExecArray | null;
	while ((match = imageRe.exec(innerHtml)) !== null) {
		const src = /\ssrc="([^"]*)"/i.exec(match[0])?.[1];
		if (src == null) {
			continue;
		}

		const tail = innerHtml.slice(match.index + match[0].length);
		const figureEnd = /<\/figure>/i.exec(tail)?.index;
		const scope = figureEnd == null ? tail : tail.slice(0, figureEnd);
		const caption = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(scope)?.[1] ?? "";

		items.push({
			src,
			hasCaption: caption.replaceAll(/<[^>]+>/g, "").trim() !== "",
		});
	}

	return items;
}

interface GallerySource {
	items: Array<GalleryItemSource>;
	/** The source's `columns-N`, for the report only — the block does not model a column count. */
	columns: number | undefined;
}

/** Every `wp-block-gallery` in the source, in document order. */
function extractGalleries(html: string): Array<GallerySource> {
	const galleries: Array<GallerySource> = [];
	const galleryRe = /<figure[^>]*class="[^"]*wp-block-gallery[^"]*"[^>]*>/gi;

	let match: RegExpExecArray | null;
	while ((match = galleryRe.exec(html)) !== null) {
		const end = findClosingFigure(html, match.index + match[0].length);
		const items = extractGalleryItems(html.slice(match.index + match[0].length, end));
		const columns = /columns-(\d+)/.exec(match[0])?.[1];

		galleries.push({ items, columns: columns == null ? undefined : Number(columns) });
	}

	return galleries;
}

type ImageCaptionMode = (typeof schema.imageCaptionModesEnum)[number];

interface StoredBlock {
	blockId: string;
	position: number;
	blockType: string;
	/** Set for `image` blocks only: the asset and the caption this placement shows. */
	image:
		| {
				assetId: string;
				assetLabel: string;
				caption: JSONContent | null;
				captionMode: ImageCaptionMode;
		  }
		| undefined;
}

interface EntityVersion {
	entityType: EntityType;
	slug: string;
	status: EntityStatusType;
	fieldId: string;
	blocks: Array<StoredBlock>;
	/**
	 * The normalised image urls of each `gallery` block already in this field, in item order. Lets a
	 * gallery this script has already regrouped be reported as done rather than as a failed match —
	 * without it, every re-run warns about work it completed itself.
	 */
	existingGalleries: Array<Array<string>>;
}

/**
 * Entities' `content` blocks for the given types, one entry per lifecycle version, blocks in
 * position order. Keyed by `type/slug`, since slugs are only unique per entity type.
 */
async function findVersions(
	entityTypes: Array<EntityType>,
): Promise<Map<string, Array<EntityVersion>>> {
	const rows = await db
		.select({
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			fieldId: schema.contentBlocks.fieldId,
			blockId: schema.contentBlocks.id,
			position: schema.contentBlocks.position,
			blockType: schema.contentBlockTypes.type,
			assetId: schema.imageContentBlocks.imageId,
			assetLabel: schema.assets.label,
			caption: schema.imageContentBlocks.caption,
			captionMode: schema.imageContentBlocks.captionMode,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.fields, eq(schema.fields.entityVersionId, schema.entityVersions.id))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(
			schema.contentBlockTypes,
			eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
		)
		.leftJoin(schema.imageContentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
		.leftJoin(schema.assets, eq(schema.imageContentBlocks.imageId, schema.assets.id))
		.where(
			and(
				inArray(schema.entityTypes.type, entityTypes),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	const byKey = groupByEntityVersion(rows, {
		documentKey: (row) => `${row.entityType}/${row.slug}`,
		create: (row): EntityVersion => {
			return {
				entityType: row.entityType,
				slug: row.slug,
				status: row.status,
				fieldId: row.fieldId,
				blocks: [],
				existingGalleries: [],
			};
		},
		add: (version, row) => {
			version.blocks.push({
				blockId: row.blockId,
				position: row.position,
				blockType: row.blockType,
				image:
					row.assetId != null && row.assetLabel != null
						? {
								assetId: row.assetId,
								assetLabel: row.assetLabel,
								caption: row.caption,
								// The left join makes every image column nullable; `caption_mode` is `not null`
								// on the row itself, so this only ever falls back for a non-image block.
								captionMode: row.captionMode ?? "inherit",
							}
						: undefined,
			});
		},
	});

	await attachExistingGalleries(byKey, entityTypes);

	return byKey;
}

/**
 * Fills in each version's `existingGalleries` from the `gallery` blocks already stored. A separate
 * query because `assets` is joined once already for the image blocks, and the item rows would
 * otherwise multiply the block rows.
 */
async function attachExistingGalleries(
	byKey: Map<string, Array<EntityVersion>>,
	entityTypes: Array<EntityType>,
): Promise<void> {
	const rows = await db
		.select({
			fieldId: schema.contentBlocks.fieldId,
			blockId: schema.contentBlocks.id,
			assetLabel: schema.assets.label,
		})
		.from(schema.galleryContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.galleryContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.innerJoin(
			schema.galleryContentBlockItems,
			eq(schema.galleryContentBlockItems.galleryContentBlockId, schema.galleryContentBlocks.id),
		)
		.innerJoin(schema.assets, eq(schema.assets.id, schema.galleryContentBlockItems.imageId))
		.where(
			and(
				inArray(schema.entityTypes.type, entityTypes),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.contentBlocks.id, schema.galleryContentBlockItems.position);

	const itemsByBlock = new Map<string, { fieldId: string; labels: Array<string> }>();
	for (const row of rows) {
		const entry = itemsByBlock.get(row.blockId) ?? { fieldId: row.fieldId, labels: [] };
		entry.labels.push(normaliseImageUrl(row.assetLabel));
		itemsByBlock.set(row.blockId, entry);
	}

	const versionsByField = new Map<string, EntityVersion>();
	for (const versions of byKey.values()) {
		for (const version of versions) {
			versionsByField.set(version.fieldId, version);
		}
	}

	for (const { fieldId, labels } of itemsByBlock.values()) {
		versionsByField.get(fieldId)?.existingGalleries.push(labels);
	}
}

/** Start indices where the version's blocks hold exactly `keys` as a consecutive `image` run. */
function findImageRuns(blocks: Array<StoredBlock>, keys: Array<string>): Array<number> {
	const starts: Array<number> = [];

	for (let start = 0; start + keys.length <= blocks.length; start++) {
		const matches = keys.every((key, offset) => {
			const block = blocks[start + offset]!;
			return block.image != null && normaliseImageUrl(block.image.assetLabel) === key;
		});
		if (matches) {
			starts.push(start);
		}
	}

	return starts;
}

/**
 * The gallery's images as image blocks in order but _not_ adjacent, or `undefined` if they are not
 * all there. Diagnostic only — never a basis for regrouping.
 *
 * This is the shape a gallery takes when its `<figcaption>`s are still standalone `rich_text`
 * blocks between the images: the migration's TipTap parse turned each caption into a paragraph, and
 * only the items a later caption backfill folded in ended up adjacent. Those captions cannot be
 * swept up mechanically — the trailing one is routinely concatenated with the prose that followed
 * the gallery, so consuming the block whole would eat real content and splitting it means guessing
 * where the caption ends. Reported for a human instead.
 */
function findInterleavedImages(
	blocks: Array<StoredBlock>,
	keys: Array<string>,
): Array<number> | undefined {
	const indices: Array<number> = [];
	let searchFrom = 0;

	for (const key of keys) {
		const index = blocks.findIndex(
			(block, at) =>
				at >= searchFrom &&
				block.image != null &&
				normaliseImageUrl(block.image.assetLabel) === key,
		);
		if (index === -1) {
			return undefined;
		}
		indices.push(index);
		searchFrom = index + 1;
	}

	return indices;
}

interface SkippedGallery {
	entityType: EntityType;
	slug: string;
	status: EntityStatusType | "—";
	images: number;
	reason: string;
	detail: string;
}

interface PlannedItem {
	assetId: string;
	assetLabel: string;
	caption: JSONContent | null;
	captionMode: ImageCaptionMode;
	/** WordPress shows a caption here but the stored block does not — surfaced in the report. */
	captionMissing: boolean;
}

interface PlannedGallery {
	startIndex: number;
	length: number;
	columns: number | undefined;
	items: Array<PlannedItem>;
}

interface FieldPlan {
	entityType: EntityType;
	slug: string;
	status: EntityStatusType;
	fieldId: string;
	blocks: Array<StoredBlock>;
	galleries: Array<PlannedGallery>;
}

function planFields(
	items: Array<WordPressItem>,
	entityTypeOf: (item: WordPressItem) => EntityType,
	versionsByKey: Map<string, Array<EntityVersion>>,
): { plans: Array<FieldPlan>; skips: Array<SkippedGallery> } {
	const plansByField = new Map<string, FieldPlan>();
	const skips: Array<SkippedGallery> = [];

	for (const item of items) {
		const galleries = extractGalleries(item.content.rendered);
		if (galleries.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(item.slug);
		const entityType = entityTypeOf(item);
		const versions = versionsByKey.get(`${entityType}/${slug}`);
		if (versions == null) {
			for (const gallery of galleries) {
				if (gallery.items.length < 2) {
					continue;
				}
				skips.push({
					entityType,
					slug,
					status: "—",
					images: gallery.items.length,
					reason: "no-entity",
					detail: "No entity of this type and slug has content blocks — page not migrated?",
				});
			}
			continue;
		}

		// One version at a time, so "exactly one matching run" is judged within a version — across
		// draft and published together every run would match twice and be skipped as ambiguous.
		for (const version of versions) {
			for (const gallery of galleries) {
				if (gallery.items.length < 2) {
					// A one-image gallery is an image block; regrouping it would only lose its `layout`.
					continue;
				}

				const keys = gallery.items.map((galleryItem) => normaliseImageUrl(galleryItem.src));

				// Already regrouped — by an earlier run of this script, or by an editor. Recognised before
				// the run match so a re-run reports it as done instead of warning about a missing run.
				const alreadyRegrouped = version.existingGalleries.some(
					(labels) =>
						labels.length === keys.length && labels.every((label, index) => label === keys[index]),
				);
				if (alreadyRegrouped) {
					skips.push({
						entityType,
						slug,
						status: version.status,
						images: gallery.items.length,
						reason: "already-regrouped",
						detail: "A gallery block with exactly these images already exists in this field.",
					});
					continue;
				}

				const starts = findImageRuns(version.blocks, keys);

				if (starts.length !== 1) {
					const interleaved =
						starts.length === 0 ? findInterleavedImages(version.blocks, keys) : undefined;

					const skip: SkippedGallery =
						interleaved != null
							? {
									entityType,
									slug,
									status: version.status,
									images: gallery.items.length,
									reason: "captions-not-folded-in",
									detail: `Images are all present at positions ${interleaved
										.map((index) => String(version.blocks[index]!.position))
										.join(", ")} but separated by ${interleaved
										.slice(1)
										.map((index, offset) => {
											const between = version.blocks.slice(interleaved[offset]! + 1, index);
											return between.map((block) => block.blockType).join("+");
										})
										.filter((types) => types !== "")
										.join(", ")} — likely the gallery's captions, still standalone blocks.`,
								}
							: {
									entityType,
									slug,
									status: version.status,
									images: gallery.items.length,
									reason: starts.length === 0 ? "no-matching-run" : "ambiguous",
									detail: `${String(starts.length)} matching image runs (expected exactly 1).`,
								};

					log.warn(
						`Skipping a ${String(gallery.items.length)}-image gallery in ${entityType}/${slug} (${version.status}) [${skip.reason}]: ${skip.detail}`,
					);
					skips.push(skip);
					continue;
				}

				const [startIndex] = starts;
				assert(startIndex != null);

				let plan = plansByField.get(version.fieldId);
				if (plan == null) {
					plan = {
						entityType,
						slug,
						status: version.status,
						fieldId: version.fieldId,
						blocks: version.blocks,
						galleries: [],
					};
					plansByField.set(version.fieldId, plan);
				}

				// Two galleries in one field must not claim the same blocks. Identical galleries repeated in
				// a post would each match the same single run, so the first one to claim it wins and the
				// second is reported rather than silently dropping blocks from under the first.
				const overlaps = plan.galleries.some(
					(planned) =>
						startIndex < planned.startIndex + planned.length &&
						planned.startIndex < startIndex + keys.length,
				);
				if (overlaps) {
					const detail = "Its image run is already claimed by another gallery in this field.";
					log.warn(
						`Skipping a ${String(gallery.items.length)}-image gallery in ${entityType}/${slug} (${version.status}) [overlapping-run]: ${detail}`,
					);
					skips.push({
						entityType,
						slug,
						status: version.status,
						images: gallery.items.length,
						reason: "overlapping-run",
						detail,
					});
					continue;
				}

				plan.galleries.push({
					startIndex,
					length: keys.length,
					columns: gallery.columns,
					items: gallery.items.map((galleryItem, offset) => {
						const block = version.blocks[startIndex + offset]!;
						assert(block.image != null);
						return {
							assetId: block.image.assetId,
							assetLabel: block.image.assetLabel,
							caption: block.image.caption,
							captionMode: block.image.captionMode,
							captionMissing: galleryItem.hasCaption && block.image.caption == null,
						};
					}),
				});
			}
		}
	}

	const plans = Array.from(plansByField.values());
	for (const plan of plans) {
		plan.galleries.sort((a, b) => a.startIndex - b.startIndex);
	}
	plans.sort((a, b) =>
		`${a.entityType}/${a.slug}/${a.status}`.localeCompare(`${b.entityType}/${b.slug}/${b.status}`),
	);

	return { plans, skips };
}

/** Regroups one field version's galleries: insert, drop the runs, then rewrite every position. */
async function applyFieldPlan(
	tx: Transaction,
	plan: FieldPlan,
	galleryTypeId: string,
): Promise<number> {
	const galleryBlockIds: Array<string> = [];

	for (const gallery of plan.galleries) {
		const [block] = await tx
			.insert(schema.contentBlocks)
			.values({
				fieldId: plan.fieldId,
				typeId: galleryTypeId,
				// Parked past the field's last block; every position is rewritten below.
				position: plan.blocks.length + galleryBlockIds.length,
			})
			.returning({ id: schema.contentBlocks.id });
		assert(block);

		await tx.insert(schema.galleryContentBlocks).values({ id: block.id, layout: "grid" });

		await tx.insert(schema.galleryContentBlockItems).values(
			gallery.items.map((item, position) => {
				return {
					galleryContentBlockId: block.id,
					imageId: item.assetId,
					position,
					caption: item.caption,
					captionMode: item.captionMode,
				};
			}),
		);

		galleryBlockIds.push(block.id);
	}

	// The subtype rows go with them: `content_blocks_type_image.id` cascades on delete.
	const replacedBlockIds = plan.galleries.flatMap((gallery) =>
		plan.blocks
			.slice(gallery.startIndex, gallery.startIndex + gallery.length)
			.map((block) => block.blockId),
	);
	await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.id, replacedBlockIds));

	// Rewrite the whole field's positions in one pass: each gallery takes the slot its run occupied,
	// and everything else keeps its relative order.
	const galleryByStartIndex = new Map(
		plan.galleries.map((gallery, index) => [gallery.startIndex, galleryBlockIds[index]!]),
	);
	const replaced = new Set(replacedBlockIds);

	const ordered: Array<string> = [];
	for (const [index, block] of plan.blocks.entries()) {
		const galleryBlockId = galleryByStartIndex.get(index);
		if (galleryBlockId != null) {
			ordered.push(galleryBlockId);
		}
		if (!replaced.has(block.blockId)) {
			ordered.push(block.blockId);
		}
	}

	for (const [position, blockId] of ordered.entries()) {
		await tx
			.update(schema.contentBlocks)
			.set({ position })
			.where(eq(schema.contentBlocks.id, blockId));
	}

	return galleryBlockIds.length;
}

async function applyPlans(plans: Array<FieldPlan>): Promise<number> {
	const [galleryType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "gallery"))
		.limit(1);
	assert(galleryType, "Missing `gallery` content block type.");

	let applied = 0;

	for (const plan of plans) {
		applied += await db.transaction((tx) => applyFieldPlan(tx, plan, galleryType.id));
	}

	return applied;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress posts and pages…");
	const [posts, pages] = await Promise.all([
		fetchAll(wordPressApiBaseUrl, "posts"),
		fetchAll(wordPressApiBaseUrl, "pages"),
	]);

	log.info("Loading migrated content blocks…");
	const versionsByKey = await findVersions([
		"news",
		"pages",
		"impact_case_studies",
		"spotlight_articles",
	]);

	const fromPosts = planFields(posts, () => "news", versionsByKey);
	const fromPages = planFields(pages, (page) => getPageEntityType(page.link), versionsByKey);

	const plans = [...fromPosts.plans, ...fromPages.plans];
	const skips = [...fromPosts.skips, ...fromPages.skips];
	const galleryCount = plans.reduce((total, plan) => total + plan.galleries.length, 0);
	const imageCount = plans.reduce(
		(total, plan) => total + plan.galleries.reduce((sum, gallery) => sum + gallery.length, 0),
		0,
	);

	const alreadyRegrouped = skips.filter((skip) => skip.reason === "already-regrouped").length;
	const needsAttention = skips.length - alreadyRegrouped;

	log.info(
		`${String(galleryCount)} galleries to regroup from ${String(imageCount)} image blocks across ${String(plans.length)} field versions (${String(alreadyRegrouped)} already done, ${String(needsAttention)} need attention).`,
	);

	const reportRows: Array<Array<string>> = [];

	for (const plan of plans) {
		for (const gallery of plan.galleries) {
			const captionsMissing = gallery.items.filter((item) => item.captionMissing).length;
			// Positions are listed rather than given as a range: earlier cleanups left gaps in the
			// numbering, so adjacent blocks routinely read as 1, 3, 5 and a range would look like a bug.
			const positions = plan.blocks
				.slice(gallery.startIndex, gallery.startIndex + gallery.length)
				.map((block) => String(block.position))
				.join(", ");

			log.info(
				`  ${plan.entityType}/${plan.slug} (${plan.status}): ${String(gallery.length)} images at positions ${positions}, columns-${gallery.columns == null ? "?" : String(gallery.columns)} → grid${
					captionsMissing > 0 ? ` — ${String(captionsMissing)} caption(s) only in WordPress` : ""
				}`,
			);

			for (const [index, item] of gallery.items.entries()) {
				reportRows.push([
					plan.entityType,
					plan.slug,
					plan.status,
					String(plan.blocks[gallery.startIndex]!.position),
					String(gallery.length),
					gallery.columns == null ? "" : String(gallery.columns),
					String(index),
					item.assetLabel,
					item.captionMode,
					item.caption == null ? "" : "yes",
					item.captionMissing ? "yes" : "",
				]);
			}
		}
	}

	await writeTsvReport(
		reportFilePath,
		[
			"entity_type",
			"slug",
			"status",
			"start_position",
			"images",
			"wordpress_columns",
			"item_position",
			"asset_label",
			"caption_mode",
			"has_caption",
			"caption_only_in_wordpress",
		],
		reportRows,
	);
	log.info(`Wrote ${reportFilePath}`);

	await writeTsvReport(
		skippedReportFilePath,
		["entity_type", "slug", "status", "images", "reason", "detail"],
		skips.map((skip) => [
			skip.entityType,
			skip.slug,
			skip.status,
			String(skip.images),
			skip.reason,
			skip.detail,
		]),
	);
	log.info(`Wrote ${skippedReportFilePath}`);

	if (!apply) {
		log.info("Pass `--apply` to regroup them into `gallery` blocks.");
		return;
	}

	const applied = await applyPlans(plans);
	log.success(`Regrouped ${String(applied)} galleries.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
