/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { formatLocaleCode } from "@/lib/locales";
import { getConsortiumMemberDocumentIds, getWebsiteHref } from "@/lib/website-routes";
import type { Database, Transaction } from "@/middlewares/db";
import type { SitemapEntityType } from "@/routes/sitemap/schemas";
import { and, eq, inArray } from "@/services/db/sql";

/**
 * Sitemap types that live in their own subtype table and are found generically via the entity type,
 * i.e. everything except `institution`, whose subtype only exists on the version row, and which
 * only has a page while it is a member of the national consortium.
 */
const documentEntityTypes = [
	"events",
	"news",
	"pages",
	"projects",
] as const satisfies ReadonlyArray<SitemapEntityType>;

function isDocumentEntityType(type: string): type is (typeof documentEntityTypes)[number] {
	return (documentEntityTypes as ReadonlyArray<string>).includes(type);
}

interface SitemapSource {
	/** Document id (`entities.id`), shared by all locale versions of one document. */
	entityId: string;
	type: SitemapEntityType;
	slug: string;
	locale: string;
	lastModified: Date;
}

/**
 * Every website url that can be derived from published content, one entry per (document, locale)
 * pair that has a published version — a document published in both locales contributes two urls,
 * each with its own locale-prefixed href.
 *
 * Each entry lists its `alternates`: the same url in every locale it resolves in, itself included,
 * as hreflang requires each url to reference itself and all of its siblings. Resolved per locale
 * version, since each version carries its own slug.
 *
 * Deliberately unpaginated: the payload is one href and one timestamp per public document per
 * locale (a few thousand today, far below the 50.000-url sitemap limit), and a sitemap that arrives
 * in pages is a sitemap the consumer can assemble incorrectly.
 */
export async function getSitemap(db: Database | Transaction) {
	const [documents, consortiumMembers] = await Promise.all([
		getPublishedDocuments(db),
		getPublishedConsortiumMembers(db),
	]);

	/**
	 * Keyed by the locale-prefixed href, not by document: several documents can share a url — the
	 * pages backing a listing page all resolve to it — and such a url is only as old as its newest
	 * document. Two different locales of the same document never collide here, since each carries its
	 * own locale segment.
	 */
	const entries = new Map<string, SitemapSource & { href: string }>();
	let unresolved = 0;

	/**
	 * Hrefs which are the same page in different locales, as a union-find forest (href → parent
	 * href). Two kinds of links: the locale versions of one document, each with its own slug; and one
	 * locale-less path across locales — a shared url like `/projects` exists in every locale any of
	 * its documents is published in, even when no single document is published in all of them.
	 */
	const parents = new Map<string, string>();
	const hrefByEntityId = new Map<string, string>();
	const hrefByPath = new Map<string, string>();

	function find(href: string): string {
		let root = href;
		for (let parent = parents.get(root); parent != null && parent !== root;) {
			root = parent;
			parent = parents.get(root);
		}
		parents.set(href, root);
		return root;
	}

	function link(href: string, other: string | undefined) {
		if (other == null) {
			return;
		}
		const root = find(href);
		const otherRoot = find(other);
		if (root !== otherRoot) {
			parents.set(root, otherRoot);
		}
	}

	for (const source of [...documents, ...consortiumMembers]) {
		const path = getWebsiteHref(source.type, { slug: source.slug, isConsortiumMember: true });

		if (path == null) {
			unresolved += 1;
			continue;
		}

		const href = `/${source.locale}${path}`;
		const entry = entries.get(href);

		if (entry == null) {
			entries.set(href, { ...source, href });
			parents.set(href, href);
		} else if (source.lastModified > entry.lastModified) {
			entry.lastModified = source.lastModified;
		}

		link(href, hrefByEntityId.get(source.entityId));
		link(href, hrefByPath.get(path));
		hrefByEntityId.set(source.entityId, href);
		hrefByPath.set(path, href);
	}

	/** Locale → href per group, keyed by the group's root href. */
	const alternatesByRoot = new Map<string, Map<string, string>>();

	for (const entry of entries.values()) {
		const root = find(entry.href);
		let alternates = alternatesByRoot.get(root);
		if (alternates == null) {
			alternates = new Map();
			alternatesByRoot.set(root, alternates);
		}
		alternates.set(entry.locale, entry.href);
	}

	const data = Array.from(entries.values())
		.toSorted((a, z) => (a.href < z.href ? -1 : a.href > z.href ? 1 : 0))
		.map((entry) => {
			return {
				href: entry.href,
				locale: entry.locale,
				type: entry.type,
				lastModified: entry.lastModified.toISOString(),
				alternates: Array.from(alternatesByRoot.get(find(entry.href)) ?? [], ([locale, href]) => {
					return { locale, href };
				}).toSorted((a, z) => (a.locale < z.locale ? -1 : a.locale > z.locale ? 1 : 0)),
			};
		});

	return { data, total: data.length, unresolved };
}

/**
 * Read across all entity types at once, rather than per type: a single query covering every
 * document type's published versions, in every locale, needs nothing from the subtype tables.
 *
 * Queries `entityVersions` directly (filtered to the `published` status) rather than through the
 * `documentLifecycle` view: that view is hardcoded to resolve each document's published version in
 * the _default_ locale only (see its definition), so it would silently drop every
 * non-default-locale published version — exactly the url a locale-aware sitemap must include.
 */
async function getPublishedDocuments(db: Database | Transaction): Promise<Array<SitemapSource>> {
	const status = await db.query.entityStatus.findFirst({
		where: { type: "published" },
		columns: { id: true },
	});
	assert(status, "No published entity status in database.");

	const rows = await db
		.select({
			entityId: schema.entityVersions.entityId,
			type: schema.entityTypes.type,
			slug: schema.slugs.value,
			languageCode: schema.locales.languageCode,
			regionCode: schema.locales.regionCode,
			lastModified: schema.entityVersions.updatedAt,
		})
		.from(schema.entityVersions)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.locales, eq(schema.locales.id, schema.entityVersions.localeId))
		.where(
			and(
				inArray(schema.entityTypes.type, documentEntityTypes),
				eq(schema.entityVersions.statusId, status.id),
			),
		);

	return rows.flatMap((row) => {
		if (!isDocumentEntityType(row.type)) {
			return [];
		}

		return [
			{
				entityId: row.entityId,
				type: row.type,
				slug: row.slug,
				locale: formatLocaleCode(row),
				lastModified: row.lastModified,
			},
		];
	});
}

/**
 * Queries `entityVersions` directly for the same reason as {@link getPublishedDocuments}: a member
 * contributes a url for every locale it is published in.
 */
async function getPublishedConsortiumMembers(
	db: Database | Transaction,
): Promise<Array<SitemapSource>> {
	const memberIds = await getConsortiumMemberDocumentIds(db);

	if (memberIds.size === 0) {
		return [];
	}

	const rows = await db
		.select({
			entityId: schema.entityVersions.entityId,
			slug: schema.slugs.value,
			languageCode: schema.locales.languageCode,
			regionCode: schema.locales.regionCode,
			lastModified: schema.entityVersions.updatedAt,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			and(
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
				eq(schema.organisationalUnitTypes.type, "institution"),
			),
		)
		.innerJoin(
			schema.entityStatus,
			and(
				eq(schema.entityStatus.id, schema.entityVersions.statusId),
				eq(schema.entityStatus.type, "published"),
			),
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.locales, eq(schema.locales.id, schema.entityVersions.localeId))
		.where(inArray(schema.entityVersions.entityId, Array.from(memberIds)));

	return rows.map((row) => {
		return {
			entityId: row.entityId,
			type: "institution" as const,
			slug: row.slug,
			locale: formatLocaleCode(row),
			lastModified: row.lastModified,
		};
	});
}
