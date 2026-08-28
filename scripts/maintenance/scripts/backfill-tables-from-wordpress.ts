import * as path from "node:path";

import { assert, createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, inArray } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table/kit";
import { generateJSON } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Restores tables that the WordPress migration flattened into prose. Dry run by default; `--apply`
 * writes the changes.
 *
 * The migration parsed content with `[StarterKit, Image]`, which has no table node types, so TipTap
 * silently unwrapped every `<table>`: cell content was spliced into the surrounding document as
 * loose nodes, so a two-column table of labels and values reads as one run-together paragraph
 * (`Post Status 100% Fixed-term contract…`), and a table whose cells held lists became an
 * alternating run of paragraphs and bullet lists. That structure only still exists in the live
 * WordPress site, so it is re-fetched from there rather than reconstructed from the flattened
 * text.
 *
 * Matching is reproduced, not guessed: each WordPress table is parsed twice — once without the
 * table extensions, which reproduces the exact node run the migration left behind, and once with
 * them, giving the `table` node to restore. A run of stored nodes is replaced only when its text
 * matches that reproduction node-for-node and it is the only such run in the entity. Comparison
 * ignores where whitespace falls (the migration's own cleanup pass moved some), but nothing else: a
 * table edited in WordPress since the migration — a column added, a row rewritten — no longer
 * matches, and is reported as skipped for a human rather than silently overwritten with newer
 * WordPress content. A restored table has no flattened run left to find, so re-running is a no-op.
 *
 * Every `rich_text` block is scanned, accordion panel bodies included — a panel's body is a
 * `rich_text` block of its own. The migration parsed accordion bodies through the same code path,
 * so tables inside them were flattened the same way.
 *
 * @example
 * 	pnpm run data:backfill:tables-from-wordpress
 * 	pnpm run data:backfill:tables-from-wordpress -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "tables-from-wordpress.tsv");

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

/** What the migration parsed with: no table node types, so `<table>` markup is unwrapped. */
const flatteningExtensions = [StarterKit, Image];
/** The same set the editor now uses, so a `<table>` becomes a real `table` node. */
const tableAwareExtensions = [StarterKit, Image, TableKit];

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

interface RtNode {
	type?: string;
	text?: string;
	content?: Array<RtNode> | null;
}

/** Readable plain text of a node — for the report preview, not for matching. */
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
	return parts.join("").replaceAll(/\s+/g, " ").trim();
}

/**
 * The key nodes are compared by: node type plus plain text with all whitespace removed. The
 * migration's cleanup pass (`normalizeRichTextDocument`) tidied `<br>`s and collapsed whitespace,
 * so a stored node can differ from a fresh parse of the same WordPress markup by a space or two.
 * Every other character must still match exactly, which over runs this long leaves no room for a
 * coincidental match.
 *
 * The type matters for more than precision: a one-paragraph flattening restores to a `table` whose
 * text is that same paragraph's, so without the type a restored table would match its own
 * flattening again on the next run.
 */
function comparisonKey(node: RtNode): string {
	return `${node.type ?? ""}:${nodePlainText(node).replaceAll(/\s+/g, "")}`;
}

/** Extracts each `<table>…</table>` in document order, outermost tags included. */
function extractTables(html: string): Array<string> {
	const results: Array<string> = [];
	const re = /<table\b[^>]*>[\s\S]*?<\/table>/gi;

	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		results.push(match[0]);
	}

	return results;
}

interface WordPressTable {
	/** The `table` node the editor's extension set produces for this markup. */
	node: RtNode;
	/** Comparison keys of the node run the migration flattened this table into. */
	flattenedKeys: Array<string>;
	rows: number;
	preview: string;
}

/**
 * Parses one table's HTML both ways: with the table extensions for the node to restore, and without
 * them to reproduce — rather than guess — the node run the migration left behind.
 */
function parseTable(tableHtml: string): WordPressTable | undefined {
	const tableDoc = generateJSON(tableHtml, tableAwareExtensions) as { content?: Array<RtNode> };
	const node = tableDoc.content?.find((child) => child.type === "table");
	if (node == null) {
		return undefined;
	}

	// Empty nodes are dropped to match the stored side: the migration's cleanup pass removed the
	// blank paragraphs that unwrapping a table's cell padding left behind.
	const flatDoc = generateJSON(tableHtml, flatteningExtensions) as { content?: Array<RtNode> };
	const flattened = (flatDoc.content ?? []).filter((child) => nodePlainText(child) !== "");
	if (flattened.length === 0) {
		return undefined;
	}

	return {
		node,
		flattenedKeys: flattened.map((child) => comparisonKey(child)),
		rows: (node.content ?? []).length,
		preview: flattened
			.map((child) => nodePlainText(child))
			.join(" ")
			.slice(0, 100),
	};
}

/**
 * One editable node list: a `rich_text` block's document.
 *
 * That covers accordion panel bodies too — a panel's body is a `rich_text` block of its own, at its
 * own place in the tree — so a flattened table inside one is found the same way as anywhere else,
 * with no second shape to walk.
 */
interface Target {
	key: string;
	blockId: string;
	nodes: Array<RtNode>;
}

/** One lifecycle version's rewritable targets, within one document. */
interface EntityVersion {
	documentId: string;
	entityType: EntityType;
	fieldId: string;
	status: EntityStatusType;
	targets: Array<Target>;
}

/**
 * Entities' `rich_text` content blocks for the given types, one entry per lifecycle version. Keyed
 * by `type/slug`, since slugs are only unique per entity type.
 */
async function findTargets(
	entityTypes: Array<EntityType>,
): Promise<Map<string, Array<EntityVersion>>> {
	const rows = await db
		.select({
			documentId: schema.entities.id,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			fieldId: schema.contentBlocks.fieldId,
			blockId: schema.contentBlocks.id,
			position: schema.contentBlocks.position,
			richTextContent: schema.richTextContentBlocks.content,
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
		.leftJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)

		.where(
			and(
				inArray(schema.entityTypes.type, entityTypes),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	return groupByEntityVersion(rows, {
		documentKey: (row) => `${row.entityType}/${row.slug}`,
		create: (row): EntityVersion => {
			return {
				documentId: row.documentId,
				entityType: row.entityType,
				fieldId: row.fieldId,
				status: row.status,
				targets: [],
			};
		},
		add: (version, row) => {
			if (row.richTextContent != null) {
				version.targets.push({
					key: `rich_text:${row.blockId}`,
					blockId: row.blockId,
					nodes: (row.richTextContent as { content?: Array<RtNode> | null }).content ?? [],
				});
			}
		},
	});
}

/** Start indices where `keys` occurs as a consecutive run in `nodes`. */
function findRuns(nodes: Array<RtNode>, keys: Array<string>): Array<number> {
	const starts: Array<number> = [];

	for (let start = 0; start + keys.length <= nodes.length; start++) {
		if (keys.every((key, offset) => comparisonKey(nodes[start + offset]!) === key)) {
			starts.push(start);
		}
	}

	return starts;
}

interface Replacement {
	startIndex: number;
	runLength: number;
	node: RtNode;
	rows: number;
	preview: string;
}

interface TargetUpdate {
	entitySlug: string;
	entityType: EntityType;
	entityDocumentId: string;
	status: EntityStatusType;
	target: Target;
	replacements: Array<Replacement>;
}

function findUpdates(
	items: Array<WordPressItem>,
	entityTypeOf: (item: WordPressItem) => EntityType,
	entitiesByKey: Map<string, Array<EntityVersion>>,
): Array<TargetUpdate> {
	const updatesByTarget = new Map<string, TargetUpdate>();

	for (const item of items) {
		const tables = extractTables(item.content.rendered);
		if (tables.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(item.slug);
		const entityType = entityTypeOf(item);
		const versions = entitiesByKey.get(`${entityType}/${slug}`);
		if (versions == null) {
			log.warn(`Skipping ${entityType}/${slug}: no entity with content blocks found.`);
			continue;
		}

		// One version at a time, so "exactly one matching node run" is judged within a version. Across
		// draft and published together a flattened table present in both would always match twice and
		// be skipped as ambiguous.
		for (const version of versions) {
			for (const tableHtml of tables) {
				const table = parseTable(tableHtml);
				if (table == null) {
					continue;
				}

				// A table restored by an earlier run leaves no flattened run to find, so idempotency falls
				// out of the matching itself. A table edited in WordPress since the migration lands here
				// too — reported, never guessed at.
				const matches: Array<{ target: Target; startIndex: number }> = [];
				for (const target of version.targets) {
					for (const startIndex of findRuns(target.nodes, table.flattenedKeys)) {
						matches.push({ target, startIndex });
					}
				}

				if (matches.length !== 1) {
					log.warn(
						`Skipping a ${String(table.rows)}-row table in ${entityType}/${slug} (${version.status}): ${String(matches.length)} matching node runs (expected exactly 1) — "${table.preview}…"`,
					);
					continue;
				}

				const [match] = matches;
				assert(match);

				if (!updatesByTarget.has(match.target.key)) {
					updatesByTarget.set(match.target.key, {
						entitySlug: slug,
						entityType,
						entityDocumentId: version.documentId,
						status: version.status,
						target: match.target,
						replacements: [],
					});
				}

				updatesByTarget.get(match.target.key)!.replacements.push({
					startIndex: match.startIndex,
					runLength: table.flattenedKeys.length,
					node: table.node,
					rows: table.rows,
					preview: table.preview,
				});
			}
		}
	}

	// Two tables in one target must not claim overlapping node runs; drop the whole target if they
	// do rather than apply a partial, index-shifted rewrite.
	for (const [key, update] of updatesByTarget) {
		const ordered = update.replacements.toSorted((a, b) => a.startIndex - b.startIndex);
		const overlaps = ordered.some((replacement, index) => {
			const previous = ordered[index - 1];
			return previous != null && previous.startIndex + previous.runLength > replacement.startIndex;
		});

		if (overlaps) {
			log.warn(
				`Skipping ${update.entityType}/${update.entitySlug} (${update.status}): overlapping table matches.`,
			);
			updatesByTarget.delete(key);
			continue;
		}

		update.replacements = ordered;
	}

	return [...updatesByTarget.values()];
}

/** Applies a target's replacements back to front, so earlier start indices stay valid. */
function applyReplacements(nodes: Array<RtNode>, replacements: Array<Replacement>): Array<RtNode> {
	let result = [...nodes];

	for (const replacement of replacements.toReversed()) {
		result = [
			...result.slice(0, replacement.startIndex),
			replacement.node,
			...result.slice(replacement.startIndex + replacement.runLength),
		];
	}

	return result;
}

const reportColumns = [
	"entity_type",
	"entity_slug",
	"entity_document_id",
	"entity_version_status",
	"block_id",
	"start_index",
	"flattened_nodes",
	"table_rows",
	"flattened_text_preview",
] as const;

async function writeReport(updates: Array<TargetUpdate>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		reportColumns,
		updates.flatMap((update) =>
			update.replacements.map((replacement) => [
				update.entityType,
				update.entitySlug,
				update.entityDocumentId,
				update.status,
				update.target.blockId,
				String(replacement.startIndex),
				String(replacement.runLength),
				String(replacement.rows),
				replacement.preview,
			]),
		),
	);
}

/**
 * Swaps each matched node run for its table, re-reading the block inside the transaction and
 * re-checking every node key, so a block edited since the report was generated is skipped rather
 * than overwritten.
 */
async function applyUpdates(updates: Array<TargetUpdate>): Promise<number> {
	let applied = 0;

	for (const update of updates) {
		await db.transaction(async (tx) => {
			const expectedKeys = update.target.nodes.map((node) => comparisonKey(node));

			const isUnchanged = (nodes: Array<RtNode>): boolean =>
				nodes.length === expectedKeys.length &&
				expectedKeys.every((key, index) => comparisonKey(nodes[index]!) === key);

			const stale = (): void => {
				log.warn(
					`Skipping ${update.entityType}/${update.entitySlug} (${update.status}): rich_text block changed since the report was generated.`,
				);
			};

			const [current] = await tx
				.select({ content: schema.richTextContentBlocks.content })
				.from(schema.richTextContentBlocks)
				.where(eq(schema.richTextContentBlocks.id, update.target.blockId))
				.limit(1);

			const nodes = (current?.content as { content?: Array<RtNode> | null } | null)?.content ?? [];
			if (!isUnchanged(nodes)) {
				stale();
				return;
			}

			await tx
				.update(schema.richTextContentBlocks)
				.set({
					content: {
						type: "doc",
						content: applyReplacements(nodes, update.replacements),
					} as JSONContent,
				})
				.where(eq(schema.richTextContentBlocks.id, update.target.blockId));

			applied += update.replacements.length;
		});
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

	log.info("Loading migrated rich_text content blocks…");
	const entitiesByKey = await findTargets([
		"news",
		"pages",
		"spotlight_articles",
		"impact_case_studies",
	]);

	const updates = [
		...findUpdates(posts, () => "news", entitiesByKey),
		...findUpdates(pages, (page) => getPageEntityType(page.link), entitiesByKey),
	];

	await writeReport(updates);

	const tableCount = updates.reduce((total, update) => total + update.replacements.length, 0);

	log.info(`${String(tableCount)} flattened tables to restore (counting each version).`);
	for (const update of updates) {
		for (const replacement of update.replacements) {
			log.info(
				`  ${update.entityType}/${update.entitySlug} (${update.status}): ${String(replacement.rows)} row(s) from ${String(replacement.runLength)} node(s) — "${replacement.preview}…"`,
			);
		}
	}
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info(`Pass \`--apply\` to restore them.`);
		return;
	}

	const applied = await applyUpdates(updates);
	log.success(`Restored ${String(applied)} tables.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
