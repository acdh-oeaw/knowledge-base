import type { JSONContent } from "@tiptap/core";
import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import {
	type LegacyClariahAtEntity,
	type LegacyClariahAtEntityType,
	getLegacyClariahAtEntity,
	isLegacyClariahAtCollection,
	legacyClariahAtListingPages,
} from "./legacy-clariah-at-paths";
import * as schema from "./schema";

/**
 * Finds links to the previous clariah.at website in rich text, and rewrites them so they work on
 * the current CLARIAH-AT website (github.com/acdh-oeaw/clariah-at-platform).
 *
 * - A link to an item the old website had a page for (a news item, event, project, consortium member
 *   or page) becomes an `entity` link to the entity the item was imported as. The old id is not the
 *   entity's slug, and the slug differs per locale and can be renamed, which an entity link
 *   survives. The api resolves it to the url of the entity in the locale being read.
 * - A link to the home page, a listing or the imprint becomes a root-relative, locale-less path. The
 *   website prefixes those with the locale being read.
 *
 * The old website prefixed every path with a locale (`/en/…`, `/de/…`), which the rewrite drops: a
 * German entry linking to the English page of an item now links to the German one. Root-relative
 * links which carry such a prefix are cleaned up as well: current website paths are stored without
 * one, so they are either old website paths, or current ones pinned to a locale
 * (`/de/pages/{slug}`), which also become entity links.
 *
 * Anything which cannot be rewritten deterministically is reported for review, and never changed.
 */

const clariahAtOrigin = "https://clariah.at";
const clariahAtHosts = new Set(["clariah.at", "www.clariah.at"]);
const legacyLocales = new Set(["de", "en"]);
/** Query parameters which only tracked where a visitor came from, and can be dropped. */
const trackingSearchParams = new Set(["ref"]);
const legacyPathMappings = new Map<string, string>([
	["/", "/"],
	["/events", "/events"],
	["/imprint", "/imprint"],
	["/news", "/news"],
	["/projects", "/projects"],
	["/resources", "/resources"],
	["/search", "/search"],
]);
/** The current website's detail routes, see `@dariah-eric/website-routes`, by path segment. */
const currentEntityRoutes = new Map<string, LegacyClariahAtEntityType>([
	["consortium", "organisational_units"],
	["events", "events"],
	["news", "news"],
	["pages", "pages"],
	["projects", "projects"],
]);

type LinkCleanupAction = "review" | "rewrite";

export interface RichTextLinkCleanupFinding {
	contentBlockId: string;
	blockType: "rich_text";
	entityId: string;
	entityType: string;
	entityLabel: string | null;
	entitySlug: string;
	fieldName: string;
	status: string;
	position: number;
	location: string;
	originalHref: string;
	/** The new href, for a link rewritten to a path. */
	replacementHref: string | null;
	/** The document id the link now targets, for a link rewritten to an entity link. */
	replacementEntityId: string | null;
	action: LinkCleanupAction;
	reason: string;
}

export interface RichTextLinkCleanupResult {
	findings: Array<RichTextLinkCleanupFinding>;
	total: number;
	rewriteTotal: number;
	reviewTotal: number;
}

type LinkReplacement = { kind: "entity"; entityId: string } | { kind: "href"; href: string };

interface LinkRewrite {
	location: string;
	originalHref: string;
	replacement: LinkReplacement;
	reason: string;
}

interface LinkReview {
	location: string;
	originalHref: string;
	reason: string;
}

interface LinkCleanupDocument {
	content: JSONContent;
	rewrites: Array<LinkRewrite>;
	reviews: Array<LinkReview>;
}

export interface RichTextLinkCleanupContext {
	/**
	 * Document ids by `{type}::{slug}`, for every slug an entity has or had (see `slug_redirects`),
	 * in any locale. Without it, no link is rewritten to an entity link.
	 */
	entityIdsBySlug?: ReadonlyMap<string, ReadonlySet<string>>;
}

interface BlockCleanup {
	block: Omit<
		RichTextLinkCleanupFinding,
		"action" | "location" | "originalHref" | "reason" | "replacementEntityId" | "replacementHref"
	>;
	rewrites: Array<LinkRewrite>;
	reviews: Array<LinkReview>;
	/** The rewritten document to write back. */
	richText?: JSONContent;
}

export function getEntitySlugKey(type: LegacyClariahAtEntityType, slug: string): string {
	return `${type}::${slug}`;
}

function normalizePathname(pathname: string): string {
	const normalized = pathname.replaceAll(/\/{2,}/gu, "/").replace(/\/+$/u, "");
	return normalized.length > 0 ? normalized : "/";
}

/**
 * Strips the locale prefix, and reports whether there was one. Strips it repeatedly, since some
 * links have it twice (`/en/en/…`).
 */
function stripLegacyLocalePrefix(pathname: string): { pathname: string; hasLocale: boolean } {
	let segments = pathname.split("/").slice(1);
	let hasLocale = false;
	while (segments[0] != null && legacyLocales.has(segments[0])) {
		segments = segments.slice(1);
		hasLocale = true;
	}
	return { pathname: `/${segments.join("/")}`, hasLocale };
}

interface ParsedHref {
	url: URL;
	isAbsolute: boolean;
}

/** The url of a link to the old website, or null for any other link. */
function parseLegacyHref(href: string): ParsedHref | null {
	const trimmed = href.trim();

	if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
		const url = new URL(trimmed, clariahAtOrigin);
		// Current website paths are stored without a locale, see `@dariah-eric/website-routes`.
		return stripLegacyLocalePrefix(url.pathname).hasLocale ? { url, isAbsolute: false } : null;
	}

	try {
		const url = new URL(trimmed);
		if (!["http:", "https:"].includes(url.protocol)) {
			return null;
		}
		return clariahAtHosts.has(url.hostname.toLowerCase()) ? { url, isAbsolute: true } : null;
	} catch {
		return null;
	}
}

type LegacyTarget =
	| { kind: "asset" }
	| { kind: "entity"; legacyEntity: LegacyClariahAtEntity }
	| { kind: "path"; pathname: string };

function mapLegacyPathname(pathname: string): LegacyTarget | null {
	const normalized = normalizePathname(
		stripLegacyLocalePrefix(normalizePathname(pathname)).pathname,
	);

	const mapped = legacyPathMappings.get(normalized);
	if (mapped != null) {
		return { kind: "path", pathname: mapped };
	}

	if (normalized.startsWith("/assets/")) {
		return { kind: "asset" };
	}

	const segments = normalized.split("/").slice(1);

	if (segments.length === 2) {
		const [collection, id] = segments as [string, string];
		const legacyEntity = isLegacyClariahAtCollection(collection)
			? getLegacyClariahAtEntity(collection, id)
			: null;
		if (legacyEntity != null) {
			return { kind: "entity", legacyEntity };
		}
		// A current website path with a locale prefix, which pins the link to that locale.
		const type = currentEntityRoutes.get(collection);
		return type != null ? { kind: "entity", legacyEntity: { type, slugs: [id] } } : null;
	}

	if (segments.length === 1) {
		const id = segments[0]!;
		const listing = legacyClariahAtListingPages[id];
		if (listing != null) {
			return { kind: "path", pathname: listing };
		}
		const legacyEntity = getLegacyClariahAtEntity("pages", id);
		return legacyEntity != null ? { kind: "entity", legacyEntity } : null;
	}

	return null;
}

function resolveLegacyEntityId(
	legacyEntity: LegacyClariahAtEntity,
	context: RichTextLinkCleanupContext,
): { entityId: string } | { reason: string } {
	if (context.entityIdsBySlug == null) {
		return { reason: "legacy_clariah_at_entity_unresolved" };
	}

	const ids = new Set<string>();
	for (const slug of legacyEntity.slugs) {
		for (const id of context.entityIdsBySlug.get(getEntitySlugKey(legacyEntity.type, slug)) ?? []) {
			ids.add(id);
		}
	}

	if (ids.size === 0) {
		return { reason: "legacy_clariah_at_entity_not_found" };
	}
	if (ids.size > 1) {
		return { reason: "legacy_clariah_at_entity_ambiguous" };
	}
	return { entityId: [...ids][0]! };
}

type ResolveHrefResult =
	| { action: "ignore" }
	| { action: "review"; reason: string }
	| { action: "rewrite"; replacement: LinkReplacement; reason: string };

export function resolveLegacyClariahAtHref(
	href: string,
	context: RichTextLinkCleanupContext = {},
): ResolveHrefResult {
	const parsed = parseLegacyHref(href);

	if (parsed == null) {
		return { action: "ignore" };
	}

	const reason = parsed.isAbsolute ? "legacy_clariah_at_url" : "legacy_clariah_at_relative_url";
	const target = mapLegacyPathname(parsed.url.pathname);

	if (target?.kind === "asset") {
		// A file of the old website has to be matched to an asset, or re-uploaded, by hand.
		return { action: "review", reason: "legacy_clariah_at_asset" };
	}

	if (target == null) {
		return {
			action: "review",
			reason: parsed.isAbsolute
				? "legacy_clariah_at_url_unmapped"
				: "legacy_clariah_at_relative_url_unmapped",
		};
	}

	const searchParams = new URLSearchParams(parsed.url.searchParams);
	for (const name of trackingSearchParams) {
		searchParams.delete(name);
	}
	const search = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

	if (target.kind === "path") {
		return {
			action: "rewrite",
			replacement: { kind: "href", href: `${target.pathname}${search}${parsed.url.hash}` },
			reason,
		};
	}

	// An entity link has no room for a query or fragment, and dropping one may change the target.
	if (search !== "" || parsed.url.hash !== "") {
		return { action: "review", reason: "legacy_clariah_at_entity_with_query_or_hash" };
	}

	const resolved = resolveLegacyEntityId(target.legacyEntity, context);
	if ("reason" in resolved) {
		return { action: "review", reason: resolved.reason };
	}

	return {
		action: "rewrite",
		replacement: { kind: "entity", entityId: resolved.entityId },
		reason,
	};
}

/**
 * The link mark or button link attributes for a replacement, see `linkTarget` in the rich text
 * editor.
 */
function applyReplacement(
	attrs: Record<string, unknown>,
	replacement: LinkReplacement,
): Record<string, unknown> {
	if (replacement.kind === "href") {
		return { ...attrs, href: replacement.href };
	}

	// Every target attribute is spelled out, as the editor does, so no stale target survives.
	return {
		...attrs,
		href: null,
		targetKind: "entity",
		assetKey: null,
		entityId: replacement.entityId,
		asset: null,
		entity: null,
	};
}

export function cleanRichTextLinksInDocument(
	content: JSONContent,
	context: RichTextLinkCleanupContext = {},
): LinkCleanupDocument {
	const rewrites: Array<LinkRewrite> = [];
	const reviews: Array<LinkReview> = [];

	function visitNode(node: JSONContent, path: string): JSONContent {
		const next: JSONContent = { ...node };

		if (node.attrs != null) {
			next.attrs = { ...node.attrs };
			// A button link carries the same target attributes as a link mark.
			if (node.type === "buttonLink" && typeof node.attrs.href === "string") {
				const href = node.attrs.href;
				const location = `${path}.attrs.href`;
				const resolved = resolveLegacyClariahAtHref(href, context);
				if (resolved.action === "review") {
					reviews.push({ location, originalHref: href, reason: resolved.reason });
				} else if (resolved.action === "rewrite") {
					rewrites.push({
						location,
						originalHref: href,
						replacement: resolved.replacement,
						reason: resolved.reason,
					});
					next.attrs = applyReplacement(node.attrs, resolved.replacement);
				}
			}
		}

		if (node.marks != null) {
			next.marks = node.marks.map((mark, index) => {
				if (mark.type !== "link" || typeof mark.attrs?.href !== "string") {
					return mark;
				}

				const href = mark.attrs.href;
				const location = `${path}.marks[${String(index)}].attrs.href`;
				const resolved = resolveLegacyClariahAtHref(href, context);

				if (resolved.action === "review") {
					reviews.push({ location, originalHref: href, reason: resolved.reason });
				}

				if (resolved.action !== "rewrite") {
					return mark;
				}

				rewrites.push({
					location,
					originalHref: href,
					replacement: resolved.replacement,
					reason: resolved.reason,
				});
				return { ...mark, attrs: applyReplacement(mark.attrs, resolved.replacement) };
			});
		}

		if (node.content != null) {
			next.content = node.content.map((child, index) =>
				visitNode(child, `${path}.content[${String(index)}]`),
			);
		}

		return next;
	}

	return { content: visitNode(content, "$"), rewrites, reviews };
}

const legacyEntityTypes: Array<LegacyClariahAtEntityType> = [
	"events",
	"news",
	"organisational_units",
	"pages",
	"projects",
];

async function getEntityIdsBySlug(db: Database | Transaction): Promise<Map<string, Set<string>>> {
	const [slugRows, redirectRows] = await Promise.all([
		db
			.select({
				entityId: schema.slugs.entityId,
				slug: schema.slugs.value,
				type: schema.entityTypes.type,
			})
			.from(schema.slugs)
			.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.slugs.typeId))
			.where(inArray(schema.entityTypes.type, legacyEntityTypes)),
		db
			.select({
				entityId: schema.slugRedirects.entityId,
				slug: schema.slugRedirects.oldValue,
				type: schema.entityTypes.type,
			})
			.from(schema.slugRedirects)
			.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.slugRedirects.typeId))
			.where(inArray(schema.entityTypes.type, legacyEntityTypes)),
	]);

	const entityIdsBySlug = new Map<string, Set<string>>();
	for (const row of [...slugRows, ...redirectRows]) {
		const key = getEntitySlugKey(row.type as LegacyClariahAtEntityType, row.slug);
		const ids = entityIdsBySlug.get(key) ?? new Set();
		ids.add(row.entityId);
		entityIdsBySlug.set(key, ids);
	}
	return entityIdsBySlug;
}

async function computeCleanups(db: Database | Transaction): Promise<Array<BlockCleanup>> {
	const context: RichTextLinkCleanupContext = {
		entityIdsBySlug: await getEntityIdsBySlug(db),
	};

	const rows = await db
		.select({
			contentBlockId: schema.contentBlocks.id,
			position: schema.contentBlocks.position,
			richTextContent: schema.richTextContentBlocks.content,
			entityId: schema.entities.id,
			entityLabel: schema.entities.label,
			entitySlug: schema.slugs.value,
			entityType: schema.entityTypes.type,
			fieldName: schema.entityTypesFieldsNames.fieldName,
			status: schema.entityStatus.type,
		})
		.from(schema.contentBlocks)
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
		.innerJoin(
			schema.richTextContentBlocks,
			eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
		);

	const cleanups: Array<BlockCleanup> = [];

	for (const row of rows) {
		const base = {
			contentBlockId: row.contentBlockId,
			entityId: row.entityId,
			entityType: row.entityType,
			entityLabel: row.entityLabel,
			entitySlug: row.entitySlug,
			fieldName: row.fieldName,
			status: row.status,
			position: row.position,
		};

		const cleanup = cleanRichTextLinksInDocument(row.richTextContent, context);

		cleanups.push({
			block: { ...base, blockType: "rich_text" },
			rewrites: cleanup.rewrites,
			reviews: cleanup.reviews,
			richText: cleanup.content,
		});
	}

	return cleanups;
}

function findingsFromCleanup(cleanup: BlockCleanup): Array<RichTextLinkCleanupFinding> {
	return [
		...cleanup.rewrites.map((rewrite) => {
			return {
				...cleanup.block,
				action: "rewrite" as const,
				location: rewrite.location,
				originalHref: rewrite.originalHref,
				replacementHref: rewrite.replacement.kind === "href" ? rewrite.replacement.href : null,
				replacementEntityId:
					rewrite.replacement.kind === "entity" ? rewrite.replacement.entityId : null,
				reason: rewrite.reason,
			};
		}),
		...cleanup.reviews.map((review) => {
			return {
				...cleanup.block,
				action: "review" as const,
				location: review.location,
				originalHref: review.originalHref,
				replacementHref: null,
				replacementEntityId: null,
				reason: review.reason,
			};
		}),
	];
}

function sortFindings(
	findings: Array<RichTextLinkCleanupFinding>,
): Array<RichTextLinkCleanupFinding> {
	return findings.toSorted(
		(a, b) =>
			a.entityType.localeCompare(b.entityType) ||
			(a.entityLabel ?? a.entitySlug).localeCompare(b.entityLabel ?? b.entitySlug) ||
			a.status.localeCompare(b.status) ||
			a.fieldName.localeCompare(b.fieldName) ||
			a.position - b.position ||
			a.contentBlockId.localeCompare(b.contentBlockId) ||
			a.action.localeCompare(b.action) ||
			a.location.localeCompare(b.location),
	);
}

export async function findRichTextLinksNeedingCleanup(
	db: Database | Transaction,
): Promise<RichTextLinkCleanupResult> {
	const cleanups = await computeCleanups(db);
	const findings = sortFindings(cleanups.flatMap((cleanup) => findingsFromCleanup(cleanup)));

	return {
		findings,
		total: findings.length,
		rewriteTotal: findings.filter((finding) => finding.action === "rewrite").length,
		reviewTotal: findings.filter((finding) => finding.action === "review").length,
	};
}

export interface CleanRichTextLinksOptions {
	/** Recorded as the actor of the `update` audit events; `null` for system/cli runs. */
	actorUserId?: string | null;
}

export interface CleanRichTextLinksResult {
	cleanedCount: number;
	rewriteTotal: number;
	/** Ids requested but not rewritten because they no longer need cleanup or no longer exist. */
	skippedIds: Array<string>;
}

export async function cleanRichTextLinks(
	db: Database | Transaction,
	ids: Array<string>,
	options: CleanRichTextLinksOptions = {},
): Promise<CleanRichTextLinksResult> {
	const { actorUserId = null } = options;

	const requested = new Set(ids);
	const cleanups = await computeCleanups(db);
	const applicable = cleanups.filter(
		(cleanup) => requested.has(cleanup.block.contentBlockId) && cleanup.rewrites.length > 0,
	);
	const applicableIds = new Set(applicable.map((cleanup) => cleanup.block.contentBlockId));
	const skippedIds = ids.filter((id) => !applicableIds.has(id));

	if (applicable.length === 0) {
		return { cleanedCount: 0, rewriteTotal: 0, skippedIds };
	}

	await db.transaction(async (tx) => {
		for (const cleanup of applicable) {
			await tx
				.update(schema.richTextContentBlocks)
				.set({ content: cleanup.richText! })
				.where(eq(schema.richTextContentBlocks.id, cleanup.block.contentBlockId));
		}

		await tx.insert(schema.auditLogs).values(
			applicable.map((cleanup) => {
				return {
					action: "update" as const,
					actorUserId,
					subjectType: "content_block",
					subjectId: cleanup.block.contentBlockId,
					summary: {
						cleanup: "rewrite_legacy_clariah_at_rich_text_links",
						blockType: cleanup.block.blockType,
						entityId: cleanup.block.entityId,
						entityType: cleanup.block.entityType,
						fieldName: cleanup.block.fieldName,
						status: cleanup.block.status,
						rewriteCount: cleanup.rewrites.length,
					},
				};
			}),
		);
	});

	return {
		cleanedCount: applicable.length,
		rewriteTotal: applicable.reduce((total, cleanup) => total + cleanup.rewrites.length, 0),
		skippedIds,
	};
}
