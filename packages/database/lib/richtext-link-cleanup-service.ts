import type { JSONContent } from "@tiptap/core";
import { eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import {
	type LegacyClariahAtEntity,
	type LegacyClariahAtEntityType,
	getLegacyClariahAtAliasEntity,
	getLegacyClariahAtEntity,
	isLegacyClariahAtCollection,
	legacyClariahAtListingPages,
} from "./legacy-clariah-at-paths";
import { isLinkTargetKind } from "./link-targets";
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
 * - A link to a file of the old website (`/assets/…`) becomes an `asset` link to the asset uploaded
 *   with the same file name, see `getAssetKeysByFilename`.
 * - A link which already targets an asset or entity keeps its target, but loses an `href` to the old
 *   website it still carries. Read paths resolve the target, and leave the link alone when the
 *   target is gone (unpublished, deleted): it should then render as plain text, not as a link to
 *   the old website.
 * - An href which is not a url but was meant to be one (a pasted markdown link, a scheme-less path)
 *   is repaired first, see `repairMalformedHref`.
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
	/** The storage key of the asset the link now targets, for a link rewritten to an asset link. */
	replacementAssetKey: string | null;
	action: LinkCleanupAction;
	reason: string;
}

export interface RichTextLinkCleanupResult {
	findings: Array<RichTextLinkCleanupFinding>;
	total: number;
	rewriteTotal: number;
	reviewTotal: number;
}

type LinkReplacement =
	/** Drops the stale `href` of a link which already targets an asset or entity. */
	| { kind: "clear_href" }
	| { kind: "asset"; assetKey: string }
	| { kind: "entity"; entityId: string }
	| { kind: "href"; href: string };

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
	/**
	 * Storage keys by file name, one per distinct file uploaded under that name (see
	 * `getAssetKeysByFilename`). Without it, no link is rewritten to an asset link.
	 */
	assetKeysByFilename?: ReadonlyMap<string, ReadonlySet<string>>;
}

interface BlockCleanup {
	block: Omit<
		RichTextLinkCleanupFinding,
		| "action"
		| "location"
		| "originalHref"
		| "reason"
		| "replacementAssetKey"
		| "replacementEntityId"
		| "replacementHref"
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
	/**
	 * `malformed`: an href which only becomes a url to the old website once repaired, see
	 * {@link repairMalformedHref}.
	 */
	kind: "absolute" | "malformed" | "relative";
}

/** A markdown link (`[text](url)`) pasted as an href, as it was, or percent-encoded. */
const markdownLinkHref = /^(?:\[|%5B).*?(?:\]|%5D)\((?<url>[^()\s]+)\)$/iu;
/** An href with a scheme (`https:`, `mailto:`, …). */
const hrefWithScheme = /^[a-z][\d+.a-z-]*:/iu;
/**
 * An old website url cut off after `https://clariah.a`, leaving `t/{locale}/…`. Seen as
 * `t/de/projects/{slug}`, where the rest is a current slug of the project the link text names.
 */
const truncatedClariahAtHref = /^t(?<path>\/(?:de|en)\/.*)$/u;

/**
 * The url an href which is not one was meant to be, or null for any other href:
 *
 * - A markdown link pasted as an href: its url;
 * - A scheme-less href to the old website (`clariah.at/en/…`), or one cut off in the middle of its
 *   host name (`t/en/…`);
 * - A scheme-less path (`about-clariah-at`, `projects/{id}/`), which a browser resolves against the
 *   page it is on, so it only ever worked by accident: the old website's root is the best guess,
 *   and its path still has to map to something to be rewritten. A first segment with a dot is a
 *   host name (`example.org/…`), not a path, and is left alone.
 */
function repairMalformedHref(href: string): string | null {
	const markdownUrl = markdownLinkHref.exec(href)?.groups?.url;
	if (markdownUrl != null) {
		return markdownUrl;
	}

	if (href === "" || hrefWithScheme.test(href) || /^[#/?]/u.test(href)) {
		return null;
	}

	const truncatedPath = truncatedClariahAtHref.exec(href)?.groups?.path;
	if (truncatedPath != null) {
		return `${clariahAtOrigin}${truncatedPath}`;
	}

	const firstSegment = href.split(/[#/?]/u)[0]!;
	if (clariahAtHosts.has(firstSegment.toLowerCase())) {
		return `https://${href}`;
	}
	return firstSegment.includes(".") ? null : `${clariahAtOrigin}/${href}`;
}

/** The url of a link to the old website, or null for any other link. */
function parseLegacyHref(href: string): ParsedHref | null {
	const trimmed = href.trim();

	const repaired = repairMalformedHref(trimmed);
	if (repaired != null) {
		const parsed = parseLegacyHref(repaired);
		return parsed != null ? { url: parsed.url, kind: "malformed" } : null;
	}

	if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
		const url = new URL(trimmed, clariahAtOrigin);
		// Current website paths are stored without a locale, see `@dariah-eric/website-routes`.
		return stripLegacyLocalePrefix(url.pathname).hasLocale ? { url, kind: "relative" } : null;
	}

	try {
		const url = new URL(trimmed);
		if (!["http:", "https:"].includes(url.protocol)) {
			return null;
		}
		return clariahAtHosts.has(url.hostname.toLowerCase()) ? { url, kind: "absolute" } : null;
	} catch {
		return null;
	}
}

const reasonsByHrefKind: Record<ParsedHref["kind"], string> = {
	absolute: "legacy_clariah_at_url",
	malformed: "legacy_clariah_at_malformed_url",
	relative: "legacy_clariah_at_relative_url",
};

function getFilename(pathname: string): string {
	const segment = pathname.split("/").at(-1) ?? "";
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

type LegacyTarget =
	| { kind: "asset"; filename: string }
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
		return { kind: "asset", filename: getFilename(normalized) };
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
		const legacyEntity = getLegacyClariahAtEntity("pages", id) ?? getLegacyClariahAtAliasEntity(id);
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

function resolveLegacyAssetKey(
	filename: string,
	context: RichTextLinkCleanupContext,
): { assetKey: string } | { reason: string } {
	if (context.assetKeysByFilename == null) {
		return { reason: "legacy_clariah_at_asset_unresolved" };
	}

	const keys = context.assetKeysByFilename.get(filename);

	if (keys == null || keys.size === 0) {
		// The file has to be uploaded, or matched to an asset under another name, by hand.
		return { reason: "legacy_clariah_at_asset_not_found" };
	}
	if (keys.size > 1) {
		return { reason: "legacy_clariah_at_asset_ambiguous" };
	}
	return { assetKey: [...keys][0]! };
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

	const reason = reasonsByHrefKind[parsed.kind];
	const target = mapLegacyPathname(parsed.url.pathname);

	if (target?.kind === "asset") {
		const resolved = resolveLegacyAssetKey(target.filename, context);
		if ("reason" in resolved) {
			return { action: "review", reason: resolved.reason };
		}
		// An asset link has no room for a query or fragment either, but neither changes a file.
		return {
			action: "rewrite",
			replacement: { kind: "asset", assetKey: resolved.assetKey },
			reason,
		};
	}

	if (target == null) {
		return { action: "review", reason: `${reason}_unmapped` };
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
 * Whether a link targets an asset or entity, by reference. A `targetKind` without its reference
 * targets nothing, and its `href` is all the link has, so it is treated as a plain link.
 */
function hasLinkTarget(attrs: Record<string, unknown>): boolean {
	if (!isLinkTargetKind(attrs.targetKind)) {
		return false;
	}
	const reference = attrs.targetKind === "asset" ? attrs.assetKey : attrs.entityId;
	return typeof reference === "string" && reference !== "";
}

/** Drops an `href` to the old website from a link which targets an asset or entity. */
function resolveStaleHref(href: string): ResolveHrefResult {
	return parseLegacyHref(href) != null
		? {
				action: "rewrite",
				replacement: { kind: "clear_href" },
				reason: "legacy_clariah_at_stale_href",
			}
		: { action: "ignore" };
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

	if (replacement.kind === "clear_href") {
		return { ...attrs, href: null };
	}

	// Every target attribute is spelled out, as the editor does, so no stale target survives.
	if (replacement.kind === "asset") {
		return {
			...attrs,
			href: null,
			targetKind: "asset",
			assetKey: replacement.assetKey,
			entityId: null,
			asset: null,
			entity: null,
		};
	}

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

	/** The cleaned attributes of a link mark or button link, or the same object when unchanged. */
	function cleanLinkAttrs(
		attrs: Record<string, unknown>,
		location: string,
	): Record<string, unknown> {
		const href = attrs.href;
		if (typeof href !== "string") {
			return attrs;
		}

		const resolved = hasLinkTarget(attrs)
			? resolveStaleHref(href)
			: resolveLegacyClariahAtHref(href, context);

		if (resolved.action === "review") {
			reviews.push({ location, originalHref: href, reason: resolved.reason });
		}
		if (resolved.action !== "rewrite") {
			return attrs;
		}

		rewrites.push({
			location,
			originalHref: href,
			replacement: resolved.replacement,
			reason: resolved.reason,
		});
		return applyReplacement(attrs, resolved.replacement);
	}

	function visitNode(node: JSONContent, path: string): JSONContent {
		const next: JSONContent = { ...node };

		if (node.attrs != null) {
			next.attrs = { ...node.attrs };
			// A button link carries the same target attributes as a link mark.
			if (node.type === "buttonLink") {
				next.attrs = cleanLinkAttrs(node.attrs, `${path}.attrs.href`);
			}
		}

		if (node.marks != null) {
			next.marks = node.marks.map((mark, index) => {
				if (mark.type !== "link" || mark.attrs == null) {
					return mark;
				}
				const attrs = cleanLinkAttrs(mark.attrs, `${path}.marks[${String(index)}].attrs.href`);
				return attrs === mark.attrs ? mark : { ...mark, attrs };
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

export interface AssetCandidate {
	key: string;
	label: string;
	filename: string | null;
	mimeType: string;
	size: number | null;
	contentHash: string | null;
}

/**
 * Storage keys by file name, for matching files of the old website to the assets they were uploaded
 * as. The upload kept the file name as the label (or `filename`), but nothing else about where a
 * file came from.
 *
 * Some files were uploaded more than once, once per locale. Assets with the same name, mime type
 * and size, whose content hashes do not disagree, are taken to be copies of one file, and the
 * oldest (assets.id is a uuidv7) stands for all of them. Copies which differ in any of those keep a
 * key each, so a link to that name is reported as ambiguous instead of being guessed at.
 *
 * Candidates are expected to be sorted oldest first.
 */
export function groupAssetKeysByFilename(
	candidates: ReadonlyArray<AssetCandidate>,
): Map<string, Set<string>> {
	const byFilename = new Map<string, Array<AssetCandidate>>();
	for (const candidate of candidates) {
		for (const name of new Set([candidate.label, candidate.filename])) {
			if (name == null || name === "") {
				continue;
			}
			const group = byFilename.get(name) ?? [];
			group.push(candidate);
			byFilename.set(name, group);
		}
	}

	const assetKeysByFilename = new Map<string, Set<string>>();
	for (const [name, group] of byFilename) {
		const representatives: Array<AssetCandidate> = [];
		for (const candidate of group) {
			const copyOf = representatives.find(
				(representative) =>
					representative.mimeType === candidate.mimeType &&
					representative.size != null &&
					representative.size === candidate.size &&
					(representative.contentHash == null ||
						candidate.contentHash == null ||
						representative.contentHash === candidate.contentHash),
			);
			if (copyOf == null) {
				representatives.push(candidate);
			}
		}
		assetKeysByFilename.set(
			name,
			new Set(representatives.map((representative) => representative.key)),
		);
	}
	return assetKeysByFilename;
}

async function getAssetKeysByFilename(
	db: Database | Transaction,
): Promise<Map<string, Set<string>>> {
	const rows = await db
		.select({
			key: schema.assets.key,
			label: schema.assets.label,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
			size: schema.assets.size,
			contentHash: schema.assets.contentHash,
		})
		.from(schema.assets)
		.orderBy(schema.assets.id);

	return groupAssetKeysByFilename(rows);
}

async function computeCleanups(db: Database | Transaction): Promise<Array<BlockCleanup>> {
	const [entityIdsBySlug, assetKeysByFilename] = await Promise.all([
		getEntityIdsBySlug(db),
		getAssetKeysByFilename(db),
	]);
	const context: RichTextLinkCleanupContext = { entityIdsBySlug, assetKeysByFilename };

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
				replacementAssetKey:
					rewrite.replacement.kind === "asset" ? rewrite.replacement.assetKey : null,
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
				replacementAssetKey: null,
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
