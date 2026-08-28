import * as path from "node:path";

import { assert, createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, gt, sql } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Re-scopes `media_text` content blocks that were derived from WordPress "Media & Text"
 * (`wp-block-media-text`) blocks so each holds only that block's `__content` — the text that sits
 * beside the media — rather than the whole rest of the article. Dry run by default; `--apply`
 * writes the changes.
 *
 * Why this is needed: the migration flattened `wp-block-media-text` into a standalone `image` block
 * followed by one `rich_text` block. When the media image was the only image in the post, that
 * `rich_text` block held the _entire_ remaining article, and the earlier media_text reconstruction
 * folded all of it into the `media_text` block — so a small media image ended up "bound" to the
 * full article. Here the live WordPress `__content` (a bounded region) is used to find where the
 * bound text actually ends: the over-captured tail is split back out into a following `rich_text`
 * block.
 *
 * Conservative and idempotent: the split point is only taken when the leading `media_text` nodes
 * match the WordPress `__content` block-for-block (by normalised plain text); anything that no
 * longer aligns (edited since, or an unusual `__content`) is skipped and reported. A `media_text`
 * whose content already equals its `__content` is left untouched.
 *
 * @example
 * 	pnpm run data:backfill:media-text-from-wordpress
 * 	pnpm run data:backfill:media-text-from-wordpress -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "media-text-from-wordpress.tsv");

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

interface WordPressPost {
	slug: string;
	content: { rendered: string };
}

/** Same `X-WP-TotalPages` pagination contract as the migration's `getAll`, kept local. */
async function fetchAllPosts(apiBaseUrl: string): Promise<Array<WordPressPost>> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: "/wp-json/wp/v2/posts",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	const results: Array<WordPressPost> = [];

	const response = await fetch(url);
	results.push(...((await response.json()) as Array<WordPressPost>));

	const pages = Number(response.headers.get("X-WP-TotalPages") ?? 1);

	for (let page = 2; page <= pages; page++) {
		url.searchParams.set("page", String(page));
		const pageResponse = await fetch(url);
		results.push(...((await pageResponse.json()) as Array<WordPressPost>));
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

/** Collapses runs of whitespace and trims — the basis for comparing WordPress and migrated text. */
function normalizeText(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

/** Index just past the `</div>` closing the `<div>` whose content starts at `afterOpenTag`. */
function findClosingDiv(html: string, afterOpenTag: number): number {
	let depth = 1;
	let i = afterOpenTag;
	while (i < html.length && depth > 0) {
		const nextOpen = html.indexOf("<div", i);
		const nextClose = html.indexOf("</div>", i);
		if (nextClose === -1) {
			break;
		}
		if (nextOpen !== -1 && nextOpen < nextClose) {
			depth++;
			i = nextOpen + 4;
		} else {
			depth--;
			i = nextClose + 6;
		}
	}
	return i;
}

interface WordPressMediaText {
	imageUrl: string;
	/** Normalised plain text of each top-level block inside `__content`, in order. */
	contentTexts: Array<string>;
}

/** Extracts each `wp-block-media-text`'s media image URL and its `__content` block texts. */
function extractMediaTextBlocks(html: string): Array<WordPressMediaText> {
	const results: Array<WordPressMediaText> = [];
	const containerRe = /<div[^>]+class="[^"]*\bwp-block-media-text\b[^"]*"[^>]*>/gi;

	let match: RegExpExecArray | null;
	while ((match = containerRe.exec(html)) !== null) {
		const end = findClosingDiv(html, match.index + match[0].length);
		const slice = html.slice(match.index, end);

		const imageUrl =
			/<figure[^>]+class="[^"]*\bwp-block-media-text__media\b[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i.exec(
				slice,
			)?.[1];
		if (imageUrl == null) {
			continue;
		}

		const contentOpen = /<div[^>]+class="[^"]*\bwp-block-media-text__content\b[^"]*"[^>]*>/i.exec(
			slice,
		);
		if (contentOpen == null) {
			continue;
		}
		const contentStart = contentOpen.index + contentOpen[0].length;
		const contentEnd = findClosingDiv(slice, contentStart);
		const contentHtml = slice.slice(contentStart, contentEnd - 6);

		const contentTexts: Array<string> = [];
		const blockRe = /<(p|h[1-6]|ul|ol|blockquote|pre|figure)\b[^>]*>([\s\S]*?)<\/\1>/gi;
		let blockMatch: RegExpExecArray | null;
		while ((blockMatch = blockRe.exec(contentHtml)) !== null) {
			const text = normalizeText(
				blockMatch[2]!.replaceAll(/<[^>]+>/g, "").replaceAll("&nbsp;", " "),
			);
			if (text !== "") {
				contentTexts.push(text);
			}
		}

		if (contentTexts.length > 0) {
			results.push({ imageUrl, contentTexts });
		}
	}

	return results;
}

interface RtNode {
	text?: string;
	content?: Array<RtNode> | null;
}

/** Normalised plain text of a stored TipTap node. */
function nodePlainText(node: RtNode): string {
	const parts: Array<string> = [];
	const visit = (n: RtNode): void => {
		if (typeof n.text === "string") {
			parts.push(n.text);
		}
		for (const child of n.content ?? []) {
			visit(child);
		}
	};
	visit(node);
	return normalizeText(parts.join(" "));
}

interface MediaTextBlock {
	blockId: string;
	fieldId: string;
	position: number;
	imageAssetLabel: string | null;
	content: { content?: Array<RtNode> | null } | null;
}

/** One lifecycle version's `media_text` blocks. */
interface MediaTextVersion {
	fieldId: string;
	status: EntityStatusType;
	blocks: Array<MediaTextBlock>;
}

/** `news` entities' `media_text` blocks, per version, keyed by entity slug. */
async function findNewsMediaTextBlocks(): Promise<Map<string, Array<MediaTextVersion>>> {
	const rows = await db
		.select({
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			blockId: schema.contentBlocks.id,
			fieldId: schema.contentBlocks.fieldId,
			position: schema.contentBlocks.position,
			imageAssetLabel: schema.assets.label,
			content: schema.mediaTextContentBlocks.content,
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
			schema.mediaTextContentBlocks,
			eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
		)
		.innerJoin(schema.assets, eq(schema.assets.id, schema.mediaTextContentBlocks.imageId))
		.where(
			and(
				eq(schema.entityTypes.type, "news"),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	return groupByEntityVersion(rows, {
		documentKey: (row) => row.slug,
		create: (row): MediaTextVersion => {
			return { fieldId: row.fieldId, status: row.status, blocks: [] };
		},
		add: (version, row) => {
			version.blocks.push({
				blockId: row.blockId,
				fieldId: row.fieldId,
				position: row.position,
				imageAssetLabel: row.imageAssetLabel,
				content: row.content ?? null,
			});
		},
	});
}

interface Candidate {
	entitySlug: string;
	status: EntityStatusType;
	blockId: string;
	fieldId: string;
	position: number;
	keptContent: JSONContent;
	tailContent: JSONContent;
	keptCount: number;
	tailCount: number;
}

function findCandidates(
	posts: Array<WordPressPost>,
	blocksBySlug: Map<string, Array<MediaTextVersion>>,
): Array<Candidate> {
	const candidates: Array<Candidate> = [];

	for (const post of posts) {
		const mediaTexts = extractMediaTextBlocks(post.content.rendered);
		if (mediaTexts.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(post.slug);
		const versions = blocksBySlug.get(slug);
		if (versions == null) {
			continue;
		}

		// Matched per version: "exactly one block uses this image" and the node alignment are both
		// properties of a single version's blocks, and the tail is inserted at that version's position.
		for (const version of versions) {
			for (const mediaText of mediaTexts) {
				const matches = version.blocks.filter(
					(block) => block.imageAssetLabel === mediaText.imageUrl,
				);
				if (matches.length !== 1) {
					continue;
				}
				const block = matches[0]!;
				const nodes = block.content?.content ?? [];
				const k = mediaText.contentTexts.length;

				if (nodes.length <= k) {
					// Already scoped (equal), or fewer nodes than `__content` — nothing to split off.
					continue;
				}

				// Only split when the leading nodes match `__content` block-for-block.
				const aligned = mediaText.contentTexts.every(
					(text, index) => nodePlainText(nodes[index]!) === text,
				);
				if (!aligned) {
					log.warn(
						`Skipping ${slug} (${version.status}, ${mediaText.imageUrl}): media_text no longer aligns with WordPress __content.`,
					);
					continue;
				}

				candidates.push({
					entitySlug: slug,
					status: version.status,
					blockId: block.blockId,
					fieldId: block.fieldId,
					position: block.position,
					keptContent: { type: "doc", content: nodes.slice(0, k) } as unknown as JSONContent,
					tailContent: { type: "doc", content: nodes.slice(k) } as unknown as JSONContent,
					keptCount: k,
					tailCount: nodes.length - k,
				});
			}
		}
	}

	return candidates;
}

const reportColumns = [
	"entity_slug",
	"entity_version_status",
	"media_text_block_id",
	"kept_nodes",
	"split_off_nodes",
] as const;

async function writeReport(candidates: Array<Candidate>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		reportColumns,
		candidates.map((candidate) => [
			candidate.entitySlug,
			candidate.status,
			candidate.blockId,
			String(candidate.keptCount),
			String(candidate.tailCount),
		]),
	);
}

/**
 * Trims each `media_text` block to its `__content` nodes and inserts the split-off tail as a
 * `rich_text` block immediately after it, re-reading the block first so a media_text edited since
 * the report was generated is skipped rather than forced.
 */
async function applyCandidates(candidates: Array<Candidate>): Promise<number> {
	const [richTextType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "rich_text"))
		.limit(1);
	assert(richTextType, "Missing `rich_text` content block type.");

	let applied = 0;

	for (const candidate of candidates) {
		await db.transaction(async (tx) => {
			const [current] = await tx
				.select({ content: schema.mediaTextContentBlocks.content })
				.from(schema.mediaTextContentBlocks)
				.where(eq(schema.mediaTextContentBlocks.id, candidate.blockId))
				.limit(1);

			const currentCount = (current?.content as { content?: Array<unknown> } | null)?.content
				?.length;
			if (currentCount !== candidate.keptCount + candidate.tailCount) {
				log.warn(
					`Skipping ${candidate.entitySlug} (${candidate.status}): media_text changed since the report was generated.`,
				);
				return;
			}

			await tx
				.update(schema.mediaTextContentBlocks)
				.set({ content: candidate.keptContent })
				.where(eq(schema.mediaTextContentBlocks.id, candidate.blockId));

			// Open a position for the tail directly after the media_text block.
			await tx
				.update(schema.contentBlocks)
				.set({ position: sql`${schema.contentBlocks.position} + 1` })
				.where(
					and(
						eq(schema.contentBlocks.fieldId, candidate.fieldId),
						gt(schema.contentBlocks.position, candidate.position),
					),
				);

			const [block] = await tx
				.insert(schema.contentBlocks)
				.values({
					fieldId: candidate.fieldId,
					typeId: richTextType.id,
					position: candidate.position + 1,
				})
				.returning({ id: schema.contentBlocks.id });
			assert(block);

			await tx
				.insert(schema.richTextContentBlocks)
				.values({ id: block.id, content: candidate.tailContent });

			applied += 1;
		});
	}

	return applied;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress posts…");
	const posts = await fetchAllPosts(wordPressApiBaseUrl);

	log.info("Loading migrated news media_text blocks…");
	const blocksBySlug = await findNewsMediaTextBlocks();

	const candidates = findCandidates(posts, blocksBySlug);

	await writeReport(candidates);

	log.info(
		`${String(candidates.length)} over-captured media_text blocks to re-scope (counting each version).`,
	);
	for (const candidate of candidates) {
		log.info(
			`  ${candidate.entitySlug} (${candidate.status}): keep ${String(candidate.keptCount)} node(s), split off ${String(candidate.tailCount)} into a new rich_text block.`,
		);
	}
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info(`Pass \`--apply\` to re-scope them.`);
		return;
	}

	const applied = await applyCandidates(candidates);
	log.success(`Re-scoped ${String(applied)} media_text blocks.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
