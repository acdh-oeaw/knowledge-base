import { assert, createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { normalizeRichTextDocument } from "@dariah-eric/database/rich-text-normalize";
import * as schema from "@dariah-eric/database/schema";
import { and, eq } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { generateJSON } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";

/**
 * Restores "Easy Accordion" (`sp-easy-accordion`) FAQ blocks that are present in the live WordPress
 * source but missing from the migrated news item — appending them as `accordion` content blocks.
 * Dry run by default; `--apply` writes the changes.
 *
 * The migration (`@dariah-eric/migrate`) already understands this accordion markup, so a missing
 * one is content drift (edited on WordPress after the one-off import) rather than an unrecognised
 * format. The item's other blocks are left untouched; only the accordion is added. Accordion
 * titles/bodies are parsed exactly as the migration parses them — the same
 * `sp-ea-single`/`ea-header`/`ea-body` extraction, the same `generateJSON` HTML→TipTap conversion,
 * and the same `normalizeRichTextDocument` clean-up — so bodies match what a re-import would
 * produce.
 *
 * Conservative and idempotent: an item is skipped when it already has any `accordion` block, so
 * re-runs and already-fixed items are left alone. Accordions are appended as trailing blocks.
 *
 * @example
 * 	pnpm run data:backfill:accordions
 * 	pnpm run data:backfill:accordions -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

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

/**
 * Returns the index just past the `</div>` that closes the `<div>` whose content starts at
 * `afterOpenTag`, counting nesting. Mirrors the migration's own `findClosingDiv`.
 */
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

/** Extracts accordion items from an Easy Accordion div. Mirrors the migration's own extractor. */
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

interface AccordionItem {
	title: string;
	content: JSONContent;
}

/** Every `sp-easy-accordion` container in the source, each parsed into ready-to-store items. */
function extractAccordions(html: string): Array<Array<AccordionItem>> {
	const accordions: Array<Array<AccordionItem>> = [];
	const accordionRe = /<div[^>]+class="[^"]*sp-easy-accordion[^"]*"[^>]*>/gi;

	let m: RegExpExecArray | null;
	while ((m = accordionRe.exec(html)) !== null) {
		const end = findClosingDiv(html, m.index + m[0].length);
		const items = extractAccordionItems(html.slice(m.index, end)).map(({ title, bodyHtml }) => {
			return {
				title,
				content: normalizeRichTextDocument(generateJSON(bodyHtml, [StarterKit, Image])),
			};
		});
		if (items.length > 0) {
			accordions.push(items);
		}
	}

	return accordions;
}

interface NewsContentField {
	fieldId: string;
	status: EntityStatusType;
	maxPosition: number;
	hasAccordion: boolean;
}

/**
 * `news` items' `content` field per version, keyed by slug: its id, last position, accordion state.
 *
 * `maxPosition` and `hasAccordion` are deliberately per-version: an accordion is appended after a
 * version's own last block, and a version that already has one is skipped on its own account.
 */
async function findNewsContentFields(): Promise<Map<string, Array<NewsContentField>>> {
	const rows = await db
		.select({
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			fieldId: schema.contentBlocks.fieldId,
			position: schema.contentBlocks.position,
			blockType: schema.contentBlockTypes.type,
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
		.where(
			and(
				eq(schema.entityTypes.type, "news"),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	return groupByEntityVersion(rows, {
		documentKey: (row) => row.slug,
		create: (row): NewsContentField => {
			return { fieldId: row.fieldId, status: row.status, maxPosition: -1, hasAccordion: false };
		},
		add: (field, row) => {
			field.maxPosition = Math.max(field.maxPosition, row.position);
			if (row.blockType === "accordion") {
				field.hasAccordion = true;
			}
		},
	});
}

interface Candidate {
	entitySlug: string;
	status: EntityStatusType;
	fieldId: string;
	position: number;
	items: Array<AccordionItem>;
}

function findCandidates(
	posts: Array<WordPressPost>,
	fieldsBySlug: Map<string, Array<NewsContentField>>,
): Array<Candidate> {
	const candidates: Array<Candidate> = [];

	for (const post of posts) {
		const accordions = extractAccordions(post.content.rendered);
		if (accordions.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(post.slug);
		const versions = fieldsBySlug.get(slug);
		if (versions == null) {
			continue;
		}

		for (const field of versions) {
			if (field.hasAccordion) {
				continue;
			}

			let nextPosition = field.maxPosition + 1;
			for (const items of accordions) {
				candidates.push({
					entitySlug: slug,
					status: field.status,
					fieldId: field.fieldId,
					position: nextPosition,
					items,
				});
				nextPosition += 1;
			}
		}
	}

	return candidates;
}

async function applyCandidates(candidates: Array<Candidate>): Promise<number> {
	const [accordionType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "accordion"))
		.limit(1);
	assert(accordionType, "Missing `accordion` content block type.");

	const [accordionItemType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "accordion_item"))
		.limit(1);
	assert(accordionItemType, "Missing `accordion_item` content block type.");

	const [richTextType] = await db
		.select({ id: schema.contentBlockTypes.id })
		.from(schema.contentBlockTypes)
		.where(eq(schema.contentBlockTypes.type, "rich_text"))
		.limit(1);
	assert(richTextType, "Missing `rich_text` content block type.");

	let applied = 0;

	for (const candidate of candidates) {
		await db.transaction(async (tx) => {
			const [block] = await tx
				.insert(schema.contentBlocks)
				.values({
					fieldId: candidate.fieldId,
					typeId: accordionType.id,
					position: candidate.position,
				})
				.returning({ id: schema.contentBlocks.id });
			assert(block);

			await tx.insert(schema.accordionContentBlocks).values({ id: block.id });

			// A panel is a block holding blocks, so each parsed item becomes an `accordion_item` with
			// its body as a `rich_text` child — the same shape the editor writes.
			for (const [position, item] of candidate.items.entries()) {
				const insertedItem: Array<{ id: string }> = await tx
					.insert(schema.contentBlocks)
					.values({
						fieldId: candidate.fieldId,
						typeId: accordionItemType.id,
						parentBlockId: block.id,
						position,
					})
					.returning({ id: schema.contentBlocks.id });
				const itemBlock: { id: string } | undefined = insertedItem[0];
				assert(itemBlock);

				await tx
					.insert(schema.accordionItemContentBlocks)
					.values({ id: itemBlock.id, title: item.title });

				const insertedBody: Array<{ id: string }> = await tx
					.insert(schema.contentBlocks)
					.values({
						fieldId: candidate.fieldId,
						typeId: richTextType.id,
						parentBlockId: itemBlock.id,
						position: 0,
					})
					.returning({ id: schema.contentBlocks.id });
				const bodyBlock: { id: string } | undefined = insertedBody[0];
				assert(bodyBlock);

				await tx
					.insert(schema.richTextContentBlocks)
					.values({ id: bodyBlock.id, content: item.content });
			}

			applied += 1;
		});
	}

	return applied;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress posts…");
	const posts = await fetchAllPosts(wordPressApiBaseUrl);

	log.info("Loading migrated news content fields…");
	const fieldsBySlug = await findNewsContentFields();

	const candidates = findCandidates(posts, fieldsBySlug);

	log.info(
		`${String(candidates.length)} accordions to append across the migrated news items (counting each version).`,
	);
	for (const candidate of candidates) {
		const titles = candidate.items.map((item) => item.title).join(" · ");
		log.info(
			`  ${candidate.entitySlug} (${candidate.status}): ${String(candidate.items.length)} items — ${titles}`,
		);
	}

	if (!apply) {
		log.info(`Pass \`--apply\` to append them as \`accordion\` blocks.`);
		return;
	}

	const applied = await applyCandidates(candidates);
	log.success(`Appended ${String(applied)} accordions.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
