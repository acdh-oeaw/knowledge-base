import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { assert, isNonEmptyString, log, unreachable } from "@acdh-oeaw/lib";
import type { Database, Transaction } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import type { StorageService } from "@acdh-knowledge-base/storage";
import type { AssetPrefix } from "@acdh-knowledge-base/storage/config";
import { buffer } from "@acdh-knowledge-base/storage/lib";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { generateJSON } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";
import { toText } from "hast-util-to-text";
import fromHtml from "rehype-parse";
import { unified } from "unified";

import { assetsCacheFilePath, assetsCacheFolderPath } from "../../config/data-migration.config";
import type { WordPressData } from "./get-wordpress-data";

const processor = unified().use(fromHtml);

export function toPlaintext(html: string): string {
	const ast = processor.parse(html);
	return toText(ast);
}

/**
 * WordPress stores `post_name`/slug values URL-encoded for non-Latin titles (e.g. Cyrillic "а" →
 * "%d0%b0"). Inserted verbatim, such slugs don't survive the browser→server URL round-trip and 404
 * on both the dashboard and the public site. Percent-decode, then slugify, so the stored slug is
 * clean transliterated ASCII — matching how UI-created entities and the institution import already
 * build slugs. Idempotent for already-clean slugs; falls back to the title when the slug is empty
 * or slugifies to nothing.
 */
export function normalizeWordPressSlug(
	rawSlug: string | null | undefined,
	fallback: string,
): string {
	const source = isNonEmptyString(rawSlug) ? rawSlug : fallback;
	let decoded: string;
	try {
		decoded = decodeURIComponent(source);
	} catch {
		// `source` had a malformed percent-sequence; slugify it as-is.
		decoded = source;
	}
	const slug = slugify(decoded);
	return slug !== "" ? slug : slugify(fallback);
}

export function toSummary(html: string): string {
	return toPlaintext(html)
		.replace(/\s*read more\s*$/i, "")
		.trim();
}

export type AssetsCache = Map<string, string>;

export async function readAssetsCacheData(): Promise<AssetsCache> {
	if (existsSync(assetsCacheFilePath)) {
		const data = await fs.readFile(assetsCacheFilePath, { encoding: "utf-8" });
		const cache = JSON.parse(data) as Array<[string, string]>;
		return new Map(cache);
	}

	await fs.mkdir(assetsCacheFolderPath, { recursive: true });

	return new Map();
}

export async function writeAssetsCacheData(cache: AssetsCache): Promise<void> {
	await fs.writeFile(assetsCacheFilePath, JSON.stringify(Array.from(cache)), { encoding: "utf-8" });
}

/** Returns the index just after the `</div>` that closes the div opened at `afterOpenTag`. */
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

/** Extracts accordion items from an Easy Accordion (`sp-easy-accordion`) div. */
function extractAccordionItems(html: string): Array<{ title: string; bodyHtml: string }> {
	const items: Array<{ title: string; bodyHtml: string }> = [];
	const singleRe = /<div[^>]+class="[^"]*sp-ea-single[^"]*"[^>]*>/gi;
	let m: RegExpExecArray | null;

	while ((m = singleRe.exec(html)) !== null) {
		const itemEnd = findClosingDiv(html, m.index + m[0].length);
		const itemHtml = html.slice(m.index, itemEnd);

		const headerMatch = /<([a-z0-9]+)[^>]+class="[^"]*ea-header[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(
			itemHtml,
		);
		const headerHtml = headerMatch?.[2] ?? "";
		const anchorMatch = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(headerHtml);
		const titleSource = anchorMatch?.[1] ?? headerHtml;
		const title = titleSource
			.replaceAll(/<[^>]+>/g, "")
			.replaceAll("&nbsp;", " ")
			.trim();

		const bodyOpenMatch = /<div[^>]+class="[^"]*ea-body[^"]*"[^>]*>/i.exec(itemHtml);
		let bodyHtml = "";
		if (bodyOpenMatch) {
			const bodyContentStart = bodyOpenMatch.index + bodyOpenMatch[0].length;
			const bodyEnd = findClosingDiv(itemHtml, bodyContentStart);
			bodyHtml = itemHtml.slice(bodyContentStart, bodyEnd - 6);
		}

		if (title || bodyHtml) {
			items.push({ title, bodyHtml });
		}
	}

	return items;
}

export interface WordPressContentMigrator {
	upload: (
		prefix: AssetPrefix,
		assetsCache: AssetsCache,
		url: URL,
		label: string,
		caption?: string,
		alt?: string,
	) => Promise<{ id: string } | undefined>;
	uploadFeaturedImage: (
		prefix: AssetPrefix,
		assetsCache: AssetsCache,
		media: WordPressData["media"],
		mediaId: number | undefined,
		id: number,
	) => Promise<string | null>;
	migrateHtmlContent: (
		tx: Transaction,
		html: string,
		assetsCache: AssetsCache,
		fieldId: string,
		contentBlockTypes: Record<string, { id: string }>,
	) => Promise<void>;
}

/**
 * Builds the WordPress → knowledge-base content helpers around a database and storage service.
 * Shared by the bulk migration (`migrate-wordpress.ts`) and the single-item migration
 * (`migrate-wordpress-news-item.ts`) so both upload assets and parse richtext content identically.
 */
export function createWordPressContentMigrator(
	db: Database,
	storage: StorageService,
): WordPressContentMigrator {
	async function readCached(assetsCache: AssetsCache, url: URL) {
		const cacheKey = String(url);

		if (assetsCache.has(cacheKey)) {
			const filePath = path.join(assetsCacheFolderPath, assetsCache.get(cacheKey)!);
			const input = await buffer.fromFilePath(filePath);
			const metadata = await buffer.getMetadata(input);

			return { input, metadata };
		}

		const input = await buffer.fromUrl(url);
		const metadata = await buffer.getMetadata(input);

		const outputFilePath = path.join(assetsCacheFolderPath, `${randomUUID()}.${metadata.format}`);
		await fs.writeFile(outputFilePath, input);
		assetsCache.set(cacheKey, path.relative(assetsCacheFolderPath, outputFilePath));
		await writeAssetsCacheData(assetsCache);

		return { input, metadata };
	}

	async function upload(
		prefix: AssetPrefix,
		assetsCache: AssetsCache,
		url: URL,
		label: string,
		caption?: string,
		alt?: string,
	) {
		const { input, metadata } = await readCached(assetsCache, url);

		const { key } = (await storage.upload({ prefix, input, metadata })).unwrap();

		const [asset] = await db
			.insert(schema.assets)
			.values({
				key,
				label,
				mimeType: metadata["content-type"],
				caption: caption === "Read more" ? null : caption,
				alt,
			})
			.returning({ id: schema.assets.id });

		return asset;
	}

	async function uploadFeaturedImage(
		prefix: AssetPrefix,
		assetsCache: AssetsCache,
		media: WordPressData["media"],
		mediaId: number | undefined,
		id: number,
	) {
		if (mediaId == null || mediaId === 0) {
			return null;
		}

		const image = media[mediaId];
		assert(image != null, `Missing featured image (entity id ${String(id)}).`);

		const url = new URL(image.source_url);
		const label = toPlaintext(image.title.rendered).trim();
		const caption = toPlaintext(image.caption.rendered).trim();
		const alt = image.alt_text;
		const asset = await upload(prefix, assetsCache, url, label, caption, alt);

		assert(asset, `Missing asset (entity id ${String(id)}).`);

		return asset.id;
	}

	/**
	 * Parses WordPress HTML into content blocks, handling inline images (uploaded as assets and
	 * stored as image content blocks), iframe embeds, and Easy Accordion widgets. Text segments
	 * between specials become rich_text blocks. Blocks are inserted in order into the given field.
	 */
	async function migrateHtmlContent(
		tx: Transaction,
		html: string,
		assetsCache: AssetsCache,
		fieldId: string,
		contentBlockTypes: Record<string, { id: string }>,
	): Promise<void> {
		type BlockSpec =
			| { type: "rich_text"; content: JSONContent }
			| { type: "image"; assetId: string }
			| { type: "embed"; url: string; title: string }
			| { type: "accordion"; items: Array<{ title: string; content: JSONContent }> };

		const blocks: Array<BlockSpec> = [];

		// Collect all special positions (iframes + accordions) sorted by index.
		interface SpecialMatch {
			index: number;
			end: number;
			segment:
				| { kind: "iframe"; src: string; title: string }
				| { kind: "accordion"; items: Array<{ title: string; bodyHtml: string }> };
		}
		const specials: Array<SpecialMatch> = [];

		const iframeRe = /<iframe(?:\s[^>]*)?\ssrc="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi;
		let m: RegExpExecArray | null;

		while ((m = iframeRe.exec(html)) !== null) {
			const titleMatch = /title="([^"]*)"/.exec(m[0]);
			specials.push({
				index: m.index,
				end: m.index + m[0].length,
				segment: { kind: "iframe", src: m[1]!, title: titleMatch?.[1] ?? m[1]! },
			});
		}

		const accordionRe = /<div[^>]+class="[^"]*sp-easy-accordion[^"]*"[^>]*>/gi;

		while ((m = accordionRe.exec(html)) !== null) {
			const end = findClosingDiv(html, m.index + m[0].length);
			specials.push({
				index: m.index,
				end,
				segment: { kind: "accordion", items: extractAccordionItems(html.slice(m.index, end)) },
			});
		}

		specials.sort((a, b) => a.index - b.index);

		type Segment =
			| { kind: "html"; content: string }
			| { kind: "iframe"; src: string; title: string }
			| { kind: "accordion"; items: Array<{ title: string; bodyHtml: string }> };

		const segments: Array<Segment> = [];
		let lastIndex = 0;
		for (const special of specials) {
			if (special.index > lastIndex) {
				segments.push({ kind: "html", content: html.slice(lastIndex, special.index) });
			}
			segments.push(special.segment);
			lastIndex = special.end;
		}
		if (lastIndex < html.length) {
			segments.push({ kind: "html", content: html.slice(lastIndex) });
		}

		for (const segment of segments) {
			if (segment.kind === "iframe") {
				blocks.push({ type: "embed", url: segment.src, title: segment.title });
				continue;
			}

			if (segment.kind === "accordion") {
				blocks.push({
					type: "accordion",
					items: segment.items.map(({ title, bodyHtml }) => {
						return {
							title,
							content: generateJSON(bodyHtml, [StarterKit, Image]),
						};
					}),
				});
				continue;
			}

			const doc = generateJSON(segment.content, [StarterKit, Image]);
			let richTextRun: Array<JSONContent> = [];

			for (const node of doc.content ?? []) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				if (node.type === "image" && typeof node.attrs?.src === "string") {
					if (richTextRun.length > 0) {
						blocks.push({
							type: "rich_text",
							content: { type: "doc", content: richTextRun },
						});
						richTextRun = [];
					}
					try {
						const asset = await upload(
							"images",
							assetsCache,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
							new URL(node.attrs.src),
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
							node.attrs.src,
							undefined,
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
							typeof node.attrs.alt === "string" && node.attrs.alt !== ""
								? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
									node.attrs.alt
								: undefined,
						);
						if (asset != null) {
							blocks.push({ type: "image", assetId: asset.id });
						}
					} catch {
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
						log.warn(`Failed to migrate inline image: ${node.attrs.src}`);
					}
				} else {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					richTextRun.push(node);
				}
			}

			if (richTextRun.length > 0) {
				blocks.push({ type: "rich_text", content: { type: "doc", content: richTextRun } });
			}
		}

		for (const [position, block] of blocks.entries()) {
			const [contentBlock] = await tx
				.insert(schema.contentBlocks)
				.values({
					position,
					fieldId,
					typeId: contentBlockTypes[block.type]!.id,
				})
				.returning({ id: schema.contentBlocks.id });

			assert(contentBlock);

			switch (block.type) {
				case "rich_text": {
					await tx
						.insert(schema.richTextContentBlocks)
						.values({ id: contentBlock.id, content: block.content });

					break;
				}

				case "image": {
					await tx
						.insert(schema.imageContentBlocks)
						.values({ id: contentBlock.id, imageId: block.assetId, caption: null });

					break;
				}

				case "embed": {
					await tx
						.insert(schema.embedContentBlocks)
						.values({ id: contentBlock.id, url: block.url, title: block.title, caption: null });

					break;
				}

				case "accordion": {
					await tx
						.insert(schema.accordionContentBlocks)
						.values({ id: contentBlock.id, items: block.items });
					break;
				}

				default: {
					unreachable();
				}
			}
		}
	}

	return { upload, uploadFeaturedImage, migrateHtmlContent };
}
