import { createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, gt, sql } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";

/**
 * Restores the button affordance of WordPress "call to action" buttons (`wp-block-button__link`) by
 * upgrading the migrated inline link _in place_ to a `buttonLink` node — keeping it at the same
 * document position it holds in WordPress. Dry run by default; `--apply` writes the changes.
 *
 * The migration (`@dariah-eric/migrate`) parses content with TipTap's `StarterKit`, whose `Link`
 * extension turned each `wp-block-button__link` anchor into an ordinary inline link at the right
 * place — so the CTA text, href, and position all survived; only the button _styling_ (the
 * `buttonLink` node, added later in #699) was lost. This finds those inline links and replaces them
 * with a `buttonLink` node, matching on both `href` **and** label text: a CTA button and an
 * ordinary link (e.g. a title linking to the same page) can share an href, so href alone would
 * wrongly button the ordinary link.
 *
 * Convergent and idempotent, so it also corrects earlier buggy runs: a `buttonLink` on a CTA href
 * whose label is not itself a CTA is downgraded back to a plain link, and a duplicate `buttonLink`
 * of an already-placed CTA is dropped (deleting its block if that leaves it empty). It scans both
 * `rich_text` and `media_text` block content. Re-running once everything is correct is a no-op.
 *
 * @example
 * 	pnpm run data:backfill:cta-button-links
 * 	pnpm run data:backfill:cta-button-links -- --apply
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

/** Decodes the handful of HTML entities that appear in button labels, then strips any tags. */
function toPlainLabel(html: string): string {
	return html
		.replaceAll(/<[^>]+>/g, "")
		.replaceAll("&amp;", "&")
		.replaceAll("&nbsp;", " ")
		.replaceAll("&#8217;", "’")
		.replaceAll("&#8211;", "–")
		.replaceAll("&quot;", '"')
		.replaceAll(/\s+/g, " ")
		.trim();
}

/** Finds `<a class="… wp-block-button__link …" href="…">Label</a>` anchors as {href, label}. */
function extractCtaButtons(html: string): Array<{ href: string; label: string }> {
	const buttons: Array<{ href: string; label: string }> = [];
	const re = /<a\b([^>]*\bclass="[^"]*\bwp-block-button__link\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi;

	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		const href = /\bhref="([^"]*)"/.exec(match[1]!)?.[1];
		const label = toPlainLabel(match[2]!);
		if (href != null && href !== "" && label !== "") {
			buttons.push({ href, label });
		}
	}

	return buttons;
}

/** Collapses whitespace and trims — CTA labels are matched on their normalised text. */
function normalizeText(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

/** Minimal shape of a stored TipTap document node — what this script reads and rewrites. */
interface RtNode {
	type?: string;
	text?: string;
	marks?: Array<{ type?: string; attrs?: { href?: unknown } | null }> | null;
	attrs?: Record<string, unknown> | null;
	content?: Array<RtNode> | null;
}

/** The href of a `link` mark on a text node, if any. */
function linkHref(node: RtNode): string | null {
	if (typeof node.text !== "string") {
		return null;
	}
	for (const mark of node.marks ?? []) {
		if (mark.type === "link" && typeof mark.attrs?.href === "string") {
			return mark.attrs.href;
		}
	}
	return null;
}

interface CtaContext {
	/** `${href}\n${normalizedLabel}` for every WordPress button — the exact CTAs to materialise. */
	keys: Set<string>;
	/** Every href used by a button — links/buttons on these hrefs are in scope for a change. */
	hrefs: Set<string>;
	/** CTA keys already materialised as a `buttonLink`, so later duplicates are dropped. */
	seen: Set<string>;
}

function ctaKey(href: string, label: string): string {
	return `${href}\n${normalizeText(label)}`;
}

/**
 * Convergent CTA rewrite of a node's children: - an inline link whose (href, text) is a CTA and not
 * yet placed → becomes a `buttonLink`; - a `buttonLink` whose href is a CTA href but whose label is
 * not itself a CTA (e.g. a heading that merely links to the same page) → downgraded back to an
 * inline link; - a duplicate `buttonLink` of an already-placed CTA → dropped. A CTA button and an
 * ordinary link can share an href, so matching is by (href, label) — never href alone. Everything
 * else is left untouched. Recurses into non-matching children.
 */
function transformChildren(children: Array<RtNode>, ctx: CtaContext): Array<RtNode> {
	const out: Array<RtNode> = [];
	let i = 0;

	while (i < children.length) {
		const node = children[i]!;

		if (node.type === "buttonLink") {
			const href = typeof node.attrs?.href === "string" ? node.attrs.href : null;
			const label = typeof node.attrs?.label === "string" ? node.attrs.label : "";
			if (href != null && ctx.keys.has(ctaKey(href, label))) {
				const key = ctaKey(href, label);
				if (!ctx.seen.has(key)) {
					ctx.seen.add(key);
					out.push(node);
				}
				// else: duplicate of an already-placed CTA — drop it.
			} else if (href != null && ctx.hrefs.has(href)) {
				// A non-CTA link on a CTA href that was wrongly turned into a button — restore the link.
				out.push({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] });
			} else {
				out.push(node);
			}
			i += 1;
			continue;
		}

		const href = linkHref(node);
		if (href != null) {
			let text = "";
			let j = i;
			while (j < children.length && linkHref(children[j]!) === href) {
				text += children[j]!.text ?? "";
				j += 1;
			}
			const key = ctaKey(href, text);
			if (ctx.keys.has(key) && !ctx.seen.has(key)) {
				ctx.seen.add(key);
				out.push({
					type: "buttonLink",
					attrs: { href, label: normalizeText(text), variant: "primary" },
				});
			} else {
				for (let k = i; k < j; k++) {
					out.push(children[k]!);
				}
			}
			i = j;
			continue;
		}

		out.push(
			node.content != null ? { ...node, content: transformChildren(node.content, ctx) } : node,
		);
		i += 1;
	}

	return out;
}

/** Whether a document still has rendered content (text or a `buttonLink`) after transforming. */
function docHasContent(node: RtNode): boolean {
	if (node.type === "buttonLink") {
		return true;
	}
	if (typeof node.text === "string" && node.text.trim() !== "") {
		return true;
	}
	return (node.content ?? []).some((child) => docHasContent(child));
}

interface EntityBlock {
	blockId: string;
	position: number;
	blockType: string;
	content: RtNode | null;
}

/** One lifecycle version's `content` field and its blocks, in position order. */
interface EntityVersion {
	fieldId: string;
	status: EntityStatusType;
	blocks: Array<EntityBlock>;
}

/** `news` entities' `content` field blocks, ordered by position, per version, keyed by slug. */
async function findNewsEntityBlocks(): Promise<Map<string, Array<EntityVersion>>> {
	const rows = await db
		.select({
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			blockId: schema.contentBlocks.id,
			fieldId: schema.contentBlocks.fieldId,
			position: schema.contentBlocks.position,
			blockType: schema.contentBlockTypes.type,
			content: schema.richTextContentBlocks.content,
			mediaTextContent: schema.mediaTextContentBlocks.content,
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
		.leftJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		)
		.leftJoin(
			schema.mediaTextContentBlocks,
			eq(schema.mediaTextContentBlocks.id, schema.contentBlocks.id),
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
		create: (row): EntityVersion => {
			return { fieldId: row.fieldId, status: row.status, blocks: [] };
		},
		add: (version, row) => {
			version.blocks.push({
				blockId: row.blockId,
				position: row.position,
				blockType: row.blockType,
				// `rich_text` and `media_text` blocks both store the same rich-text doc shape and can hold
				// a CTA link; only one join matches per row.
				content: row.content ?? row.mediaTextContent ?? null,
			});
		},
	});
}

interface Upgrade {
	blockId: string;
	blockType: string;
	content: RtNode;
}

interface Plan {
	entitySlug: string;
	status: EntityStatusType;
	fieldId: string;
	/** Blocks whose content changed (link ↔ buttonLink rewrites) and must be written back. */
	upgrades: Array<Upgrade>;
	/** Blocks left empty after dropping a duplicate `buttonLink`, to delete. */
	deletions: Array<{ blockId: string; position: number }>;
}

/**
 * One version at a time: the duplicate-CTA bookkeeping (`ctx.seen`) walks a single version's blocks
 * in document order, and the position fix-ups on deletion are scoped to that version's field.
 */
function planForVersion(
	entitySlug: string,
	version: EntityVersion,
	buttons: Array<{ href: string; label: string }>,
): Plan | null {
	const ctx: CtaContext = {
		keys: new Set(buttons.map((button) => ctaKey(button.href, button.label))),
		hrefs: new Set(buttons.map((button) => button.href)),
		seen: new Set(),
	};

	const upgrades: Array<Upgrade> = [];
	const deletions: Array<{ blockId: string; position: number }> = [];

	// Process in document order so the earliest, correctly-placed occurrence becomes the CTA and
	// later duplicates are dropped. Both `rich_text` and `media_text` blocks carry body text.
	for (const block of version.blocks) {
		if (block.blockType !== "rich_text" && block.blockType !== "media_text") {
			continue;
		}
		if (block.content == null) {
			continue;
		}

		const before = JSON.stringify(block.content);
		const content: RtNode = {
			...block.content,
			content: transformChildren(block.content.content ?? [], ctx),
		};
		if (JSON.stringify(content) === before) {
			continue;
		}

		// A `media_text` block always keeps its image, so it is only ever rewritten, never deleted.
		if (block.blockType === "rich_text" && !docHasContent(content)) {
			deletions.push({ blockId: block.blockId, position: block.position });
		} else {
			upgrades.push({ blockId: block.blockId, blockType: block.blockType, content });
		}
	}

	if (upgrades.length === 0 && deletions.length === 0) {
		return null;
	}

	return { entitySlug, status: version.status, fieldId: version.fieldId, upgrades, deletions };
}

function buildPlans(
	posts: Array<WordPressPost>,
	blocksBySlug: Map<string, Array<EntityVersion>>,
): Array<Plan> {
	const plans: Array<Plan> = [];

	for (const post of posts) {
		const buttons = extractCtaButtons(post.content.rendered);
		if (buttons.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(post.slug);
		const versions = blocksBySlug.get(slug);
		if (versions == null) {
			continue;
		}

		for (const version of versions) {
			const plan = planForVersion(slug, version, buttons);
			if (plan != null) {
				plans.push(plan);
			}
		}
	}

	return plans;
}

async function applyPlans(plans: Array<Plan>): Promise<{ upgraded: number; removed: number }> {
	let upgraded = 0;
	let removed = 0;

	for (const plan of plans) {
		await db.transaction(async (tx) => {
			for (const upgrade of plan.upgrades) {
				const content = upgrade.content as unknown as JSONContent;
				if (upgrade.blockType === "media_text") {
					await tx
						.update(schema.mediaTextContentBlocks)
						.set({ content })
						.where(eq(schema.mediaTextContentBlocks.id, upgrade.blockId));
				} else {
					await tx
						.update(schema.richTextContentBlocks)
						.set({ content })
						.where(eq(schema.richTextContentBlocks.id, upgrade.blockId));
				}
				upgraded += 1;
			}

			// Delete duplicates high-position-first so each position gap is closed independently.
			for (const deletion of plan.deletions.toSorted((a, b) => b.position - a.position)) {
				await tx.delete(schema.contentBlocks).where(eq(schema.contentBlocks.id, deletion.blockId));
				await tx
					.update(schema.contentBlocks)
					.set({ position: sql`${schema.contentBlocks.position} - 1` })
					.where(
						and(
							eq(schema.contentBlocks.fieldId, plan.fieldId),
							gt(schema.contentBlocks.position, deletion.position),
						),
					);
				removed += 1;
			}
		});
	}

	return { upgraded, removed };
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress posts…");
	const posts = await fetchAllPosts(wordPressApiBaseUrl);

	log.info("Loading migrated news content blocks…");
	const blocksBySlug = await findNewsEntityBlocks();

	const plans = buildPlans(posts, blocksBySlug);

	const totalUpgrades = plans.reduce((sum, plan) => sum + plan.upgrades.length, 0);
	const totalDeletions = plans.reduce((sum, plan) => sum + plan.deletions.length, 0);
	log.info(
		`${String(totalUpgrades)} block(s) to rewrite and ${String(totalDeletions)} empty duplicate block(s) to remove across ${String(plans.length)} item versions.`,
	);
	for (const plan of plans) {
		log.info(
			`  ${plan.entitySlug} (${plan.status}): rewrite ${String(plan.upgrades.length)} block(s), delete ${String(plan.deletions.length)} block(s)`,
		);
	}

	if (!apply) {
		log.info(`Pass \`--apply\` to apply the CTA rewrites.`);
		return;
	}

	const { upgraded, removed } = await applyPlans(plans);
	log.success(`Rewrote ${String(upgraded)} block(s) and removed ${String(removed)} duplicate(s).`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
