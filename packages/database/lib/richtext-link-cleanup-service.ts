import { getEntityListHref, resolveInterimPagePath } from "@dariah-eric/website-routes";
import type { JSONContent } from "@tiptap/core";
import { and, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "./index";
import * as schema from "./schema";

const legacyOrigin = "https://www.dariah.eu";
const dariahHosts = new Set(["dariah.eu", "www.dariah.eu"]);
const ignoredSchemes = /^(?:#|mailto:|tel:|urn:|doi:|javascript:)/iu;
const exactLegacyPathMappings = new Map<string, string>([
	[
		"/2018/06/27/dariah-eu-workshop-at-the-gi_forum-2018",
		"/news/dariah-eu-workshop-at-the-gi-forum-2018",
	],
	[
		"/2020/12/10/dariah-themecall-2020-2021-meet-the-winning-projects",
		"/news/dariah-theme-call-2020-2021-meet-the-winning-projects",
	],
	["/about/dariah-in-nutshell", "/about/dariah-in-a-nutshell"],
	["/about/dariah-in-a-nutshell.html", "/about/dariah-in-a-nutshell"],
	["/about/documents-list", getEntityListHref("document-or-policy")],
	["/about/history-of-dariah", "/about/dariah-in-a-nutshell"],
	["/about/join-dariah", "/get-involved/join-dariah"],
	["/about/mission-vision", "/about/dariah-in-a-nutshell"],
	["/about/organisation/board-of-directors.html", "/about/organisation-and-governance"],
	["/about/organisation.html", "/about/organisation-and-governance"],
	["/about/organization-and-governance", "/about/organisation-and-governance"],
	["/activities/dariah-theme", "/get-involved/funding-calls"],
	["/activities/open-science", "/about/strategy"],
	["/activities/open-science/dariah-open", "/about/strategy"],
	["/activities/open-science/data-re-use", "/about/strategy"],
	["/activities/open-science/openmethods", "/about/strategy"],
	["/activities/open-science/transformations", "/resources/transformations"],
	["/activities/projects-list", getEntityListHref("project")],
	["/activities/training-and-education", "/about/strategy"],
	["/activities/working-groups-list", getEntityListHref("working-group")],
	["/activities/working-groups.html", getEntityListHref("working-group")],
	["/category/news", getEntityListHref("news-item")],
	["/contact", "/contact"],
	["/news-events/annual-events", "https://annualevent.dariah.eu/documents"],
	["/news-events/dariah-newsletters", "/newsletters"],
	["/members-and-partners", getEntityListHref("country")],
	["/privacy-policy", "/privacy-policy"],
	["/subscribe", "/newsletters"],
	["/teach", "https://teach.dariah.eu/"],
	["/terms-of-use", "/terms-of-use"],
	[
		"/tools-services/tools-and-services/tools/hypotheses-org-academic-blogs",
		"https://hypotheses.org/",
	],
	["/tools-services/tools-and-services", "/resources/resource-catalogue"],
]);

const legacyDariahThemeSlugMappings = new Map<string, string>([
	["dariah-theme-2015", "dariah-theme-2015-open-humanities"],
	["dariah-theme-2016", "dariah-theme-2016-public-humanities"],
	["dariah-theme-2017", "dariah-theme-2017-cultural-heritage-and-humanities-research"],
	["dariah-theme-2018", "dariah-theme-2018-sustainability"],
	["dariah-theme-2020", "dariah-theme-2020-arts-exchanges-and-arts-humanities-and-covid-19"],
	["dariah-theme-2022", "dariah-theme-2022-workflows"],
	["dariah-theme-2024", "dariah-theme-2024-mistakes"],
]);

const prefixLegacyPathMappings = new Map<string, string>([
	["/activities/impact-case-studies", getEntityListHref("impact-case-study")],
	["/activities/projects", getEntityListHref("project")],
	["/activities/projects-and-affiliations", getEntityListHref("project")],
	["/activities/spotlight", getEntityListHref("spotlight-article")],
	["/activities/working-groups", getEntityListHref("working-group")],
	["/about/partners-countries", getEntityListHref("country")],
	["/event", getEntityListHref("event")],
	["/network/partners-countries", getEntityListHref("country")],
]);

const canonicalPathPrefixes = [
	"/about/dariah-in-a-nutshell",
	"/about/documents",
	"/about/impact-case-studies",
	"/about/organisation-and-governance",
	"/about/strategy",
	"/contact",
	"/events",
	"/get-involved/funding-calls",
	"/get-involved/join-dariah",
	"/get-involved/opportunities",
	"/network/members-and-partners",
	"/network/regional-hubs",
	"/network/working-groups",
	"/news",
	"/newsletters",
	"/persons",
	"/privacy-policy",
	"/privacy-and-legal/accessibility-declaration",
	"/privacy-and-legal/legal-notice",
	"/projects",
	"/resources/dariah-campus",
	"/resources/resource-catalogue",
	"/resources/ssh-open-marketplace",
	"/resources/transformations",
	"/spotlight",
	"/terms-of-use",
];

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
	replacementHref: string | null;
	action: LinkCleanupAction;
	reason: string;
}

export interface RichTextLinkCleanupResult {
	findings: Array<RichTextLinkCleanupFinding>;
	total: number;
	rewriteTotal: number;
	reviewTotal: number;
}

interface LinkRewrite {
	location: string;
	originalHref: string;
	replacementHref: string;
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
	eventSlugs?: ReadonlySet<string>;
	fundingCallSlugs?: ReadonlySet<string>;
	newsSlugs?: ReadonlySet<string>;
	projectSlugs?: ReadonlySet<string>;
}

interface BlockCleanup {
	block: Omit<
		RichTextLinkCleanupFinding,
		"action" | "location" | "originalHref" | "reason" | "replacementHref"
	>;
	rewrites: Array<LinkRewrite>;
	reviews: Array<LinkReview>;
	/** The rewritten document to write back. */
	richText?: JSONContent;
}

function normalizePathname(pathname: string): string {
	const normalized = pathname.replaceAll(/\/{2,}/gu, "/").replace(/\/+$/u, "");
	return normalized.length > 0 ? normalized : "/";
}

function startsWithPathPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function replacePathPrefix(pathname: string, from: string, to: string): string {
	if (pathname === from) {
		return to;
	}
	return `${to}${pathname.slice(from.length)}`;
}

function stripLocalePrefix(pathname: string): string {
	for (const locale of ["en", "en-GB"]) {
		const prefix = `/${locale}`;
		if (pathname === prefix) {
			return "/";
		}
		if (pathname.startsWith(`${prefix}/`)) {
			return pathname.slice(prefix.length);
		}
	}
	return pathname;
}

function isCanonicalPath(pathname: string): boolean {
	return canonicalPathPrefixes.some((prefix) => startsWithPathPrefix(pathname, prefix));
}

function getSinglePathSegmentAfter(pathname: string, prefix: string): string | null {
	if (!pathname.startsWith(`${prefix}/`)) {
		return null;
	}

	const suffix = pathname.slice(prefix.length + 1);
	return suffix.length > 0 && !suffix.includes("/") ? suffix : null;
}

function mapLegacyPathname(
	pathname: string,
	context: RichTextLinkCleanupContext = {},
): string | null {
	const normalized = normalizePathname(stripLocalePrefix(pathname));

	if (normalized === "/") {
		return "/";
	}

	if (normalized.startsWith("/wp-content/uploads/")) {
		return null;
	}

	const exactMatch = exactLegacyPathMappings.get(normalized);
	if (exactMatch != null) {
		return exactMatch;
	}

	for (const [from, to] of prefixLegacyPathMappings) {
		if (startsWithPathPrefix(normalized, from)) {
			return replacePathPrefix(normalized, from, to);
		}
	}

	const datedNewsMatch = /^\/\d{4}\/\d{2}\/\d{2}\/([^/]+)$/u.exec(normalized);
	if (datedNewsMatch != null) {
		const slug = datedNewsMatch[1]!;
		if (context.newsSlugs?.has(slug) === true) {
			return `/news/${slug}`;
		}
	}

	const eventSlug = getSinglePathSegmentAfter(normalized, "/event");
	if (eventSlug != null && context.eventSlugs?.has(eventSlug) === true) {
		return `/events/${eventSlug}`;
	}

	const dariahThemeSlug = getSinglePathSegmentAfter(normalized, "/activities/dariah-theme");
	if (dariahThemeSlug != null) {
		const mappedSlug = legacyDariahThemeSlugMappings.get(dariahThemeSlug) ?? dariahThemeSlug;
		if (context.fundingCallSlugs == null || context.fundingCallSlugs.has(mappedSlug)) {
			return `/get-involved/funding-calls/${mappedSlug}`;
		}
	}

	const projectSlug = getSinglePathSegmentAfter(
		normalized,
		"/activities/projects-and-affiliations",
	);
	if (projectSlug != null && context.projectSlugs?.has(projectSlug) === true) {
		return `/projects/${projectSlug}`;
	}

	const slug = normalized.split("/").findLast((part) => part.length > 0);
	if (slug != null) {
		const pagePath = resolveInterimPagePath(slug);
		if (pagePath != null) {
			return pagePath;
		}
	}

	if (isCanonicalPath(normalized)) {
		return normalized;
	}

	return null;
}

interface ParsedHref {
	url: URL;
	isInternal: boolean;
	isDariahAbsolute: boolean;
}

function parseHref(href: string): ParsedHref | null {
	const trimmed = href.trim();

	if (trimmed.length === 0 || ignoredSchemes.test(trimmed) || trimmed.startsWith("//")) {
		return null;
	}

	try {
		const url = new URL(trimmed);
		const isDariahAbsolute = dariahHosts.has(url.hostname.toLowerCase());
		return {
			url,
			isInternal: isDariahAbsolute,
			isDariahAbsolute,
		};
	} catch {
		// Continue below: no scheme means a WordPress relative/root-relative link candidate.
	}

	try {
		const url = new URL(trimmed, legacyOrigin);
		return {
			url,
			isInternal: true,
			isDariahAbsolute: false,
		};
	} catch {
		return null;
	}
}

type ResolveHrefResult =
	| { action: "ignore" }
	| { action: "review"; reason: string }
	| { action: "rewrite"; href: string; reason: string };

export function resolveLegacyDariahHref(href: string): ResolveHrefResult {
	return resolveLegacyDariahHrefWithContext(href);
}

function resolveLegacyDariahHrefWithContext(
	href: string,
	context: RichTextLinkCleanupContext = {},
): ResolveHrefResult {
	const parsed = parseHref(href);

	if (parsed == null || !parsed.isInternal) {
		return { action: "ignore" };
	}

	const normalizedPathname = normalizePathname(stripLocalePrefix(parsed.url.pathname));
	if (normalizedPathname === "/" && parsed.url.search !== "") {
		if (parsed.url.searchParams.get("s")?.toLowerCase() === "training") {
			return {
				action: "rewrite",
				href: "/search?dariah-website[query]=trainingtuesday&dariah-website[menu][type]=news-item",
				reason: parsed.isDariahAbsolute ? "legacy_dariah_search" : "legacy_relative_search",
			};
		}

		return {
			action: "review",
			reason: parsed.isDariahAbsolute
				? "internal_dariah_search_unmapped"
				: "relative_search_unmapped",
		};
	}

	const mappedPathname = mapLegacyPathname(parsed.url.pathname, context);

	if (mappedPathname == null) {
		if (parsed.url.pathname.startsWith("/wp-content/uploads/")) {
			return { action: "ignore" };
		}
		return {
			action: "review",
			reason: parsed.isDariahAbsolute ? "internal_dariah_url_unmapped" : "relative_url_unmapped",
		};
	}

	const replacementHref = `${mappedPathname}${parsed.url.search}${parsed.url.hash}`;
	if (replacementHref === href) {
		return { action: "ignore" };
	}

	return {
		action: "rewrite",
		href: replacementHref,
		reason: parsed.isDariahAbsolute ? "legacy_dariah_url" : "legacy_relative_url",
	};
}

function cleanHref(
	href: string,
	location: string,
	rewrites: Array<LinkRewrite>,
	reviews: Array<LinkReview>,
	context: RichTextLinkCleanupContext,
): string {
	const resolved = resolveLegacyDariahHrefWithContext(href, context);

	if (resolved.action === "rewrite") {
		rewrites.push({
			location,
			originalHref: href,
			replacementHref: resolved.href,
			reason: resolved.reason,
		});
		return resolved.href;
	}

	if (resolved.action === "review") {
		reviews.push({ location, originalHref: href, reason: resolved.reason });
	}

	return href;
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
			if (node.type === "buttonLink" && typeof node.attrs.href === "string") {
				next.attrs.href = cleanHref(
					node.attrs.href,
					`${path}.attrs.href`,
					rewrites,
					reviews,
					context,
				);
			}
		}

		if (node.marks != null) {
			next.marks = node.marks.map((mark, index) => {
				const nextMark = { ...mark };
				if (mark.attrs != null) {
					nextMark.attrs = { ...mark.attrs };
					if (mark.type === "link" && typeof mark.attrs.href === "string") {
						nextMark.attrs.href = cleanHref(
							mark.attrs.href,
							`${path}.marks[${String(index)}].attrs.href`,
							rewrites,
							reviews,
							context,
						);
					}
				}
				return nextMark;
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

async function computeCleanups(db: Database | Transaction): Promise<Array<BlockCleanup>> {
	const slugRows = await db
		.select({
			slug: schema.slugs.value,
			type: schema.entityTypes.type,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(
			schema.slugs,
			and(eq(schema.slugs.entityId, schema.entities.id), eq(schema.slugs.isPublished, true)),
		)
		.where(inArray(schema.entityTypes.type, ["events", "funding_calls", "news", "projects"]));
	const context: RichTextLinkCleanupContext = {
		eventSlugs: new Set(slugRows.filter((row) => row.type === "events").map((row) => row.slug)),
		fundingCallSlugs: new Set(
			slugRows.filter((row) => row.type === "funding_calls").map((row) => row.slug),
		),
		newsSlugs: new Set(slugRows.filter((row) => row.type === "news").map((row) => row.slug)),
		projectSlugs: new Set(slugRows.filter((row) => row.type === "projects").map((row) => row.slug)),
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
				replacementHref: rewrite.replacementHref,
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
						cleanup: "rewrite_legacy_rich_text_links",
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
