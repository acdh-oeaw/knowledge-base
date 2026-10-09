/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { getWebsiteHref } from "@/lib/website-routes";
import type { Database, Transaction } from "@/middlewares/db";
import type { SitemapEntityType } from "@/routes/sitemap/schemas";
import { and, eq, inArray } from "@/services/db/sql";

/**
 * Sitemap types that live in their own subtype table and are found generically via the entity type,
 * i.e. everything except the organisational-unit subtypes (whose subtype only exists on the version
 * row, and which need their own published-and-has-a-page filters).
 */
const documentEntityTypes = [
	"documents_policies",
	"events",
	"funding_calls",
	"impact_case_studies",
	"news",
	"opportunities",
	"pages",
	"persons",
	"projects",
	"spotlight_articles",
] as const satisfies ReadonlyArray<SitemapEntityType>;

function isDocumentEntityType(type: string): type is (typeof documentEntityTypes)[number] {
	return (documentEntityTypes as ReadonlyArray<string>).includes(type);
}

/**
 * BCP 47-style locale code (e.g. "de" or "de-AT"), matching the `?locale=` query param this api
 * accepts elsewhere and the locale segment the frontend prefixes every route with.
 */
function formatLocaleCode(locale: { languageCode: string; regionCode: string | null }): string {
	return locale.regionCode != null
		? `${locale.languageCode}-${locale.regionCode}`
		: locale.languageCode;
}

interface SitemapSource {
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
 * Deliberately unpaginated: the payload is one href and one timestamp per public document per
 * locale (a few thousand today, far below the 50.000-url sitemap limit), and a sitemap that arrives
 * in pages is a sitemap the consumer can assemble incorrectly.
 */
export async function getSitemap(db: Database | Transaction) {
	const [documents, workingGroups, countries] = await Promise.all([
		getPublishedDocuments(db),
		getPublishedWorkingGroups(db),
		getPublishedCountries(db),
	]);

	/**
	 * Keyed by the locale-prefixed href, not by document: several documents can share a url — every
	 * document and policy is surfaced on `/en/about/documents` — and such a url is only as old as its
	 * newest document. Two different locales of the same document never collide here, since each
	 * carries its own locale segment.
	 */
	const entries = new Map<string, SitemapSource & { href: string }>();
	let unresolved = 0;

	for (const source of [...documents, ...workingGroups, ...countries]) {
		const path = getWebsiteHref(source.type, { slug: source.slug });

		if (path == null) {
			unresolved += 1;
			continue;
		}

		const href = `/${source.locale}${path}`;
		const entry = entries.get(href);

		if (entry == null) {
			entries.set(href, { ...source, href });
		} else if (source.lastModified > entry.lastModified) {
			entry.lastModified = source.lastModified;
		}
	}

	const data = Array.from(entries.values())
		.toSorted((a, z) => (a.href < z.href ? -1 : a.href > z.href ? 1 : 0))
		.map((entry) => {
			return {
				href: entry.href,
				locale: entry.locale,
				type: entry.type,
				lastModified: entry.lastModified.toISOString(),
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
				type: row.type,
				slug: row.slug,
				locale: formatLocaleCode(row),
				lastModified: row.lastModified,
			},
		];
	});
}

async function getPublishedWorkingGroups(
	db: Database | Transaction,
): Promise<Array<SitemapSource>> {
	const items = await db.query.workingGroups.findMany({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					slug: {
						columns: { value: true },
					},
					locale: {
						columns: { languageCode: true, regionCode: true },
					},
				},
			},
		},
	});

	return items.flatMap((item) => {
		if (item.entityVersion.slug == null) {
			return [];
		}

		return [
			{
				type: "working_group" as const,
				slug: item.entityVersion.slug.value,
				locale: formatLocaleCode(item.entityVersion.locale),
				lastModified: item.entityVersion.updatedAt,
			},
		];
	});
}

/**
 * Countries come from the members-and-partners view rather than from all published countries: a
 * country page exists only for members, observers and cooperating partners — exactly what the view
 * holds, and exactly what `/api/v1/members-partners` serves.
 */
async function getPublishedCountries(db: Database | Transaction): Promise<Array<SitemapSource>> {
	const items = await db.query.membersAndPartners.findMany({
		where: {
			entityVersion: {
				status: {
					type: "published",
				},
			},
		},
		columns: {
			id: true,
		},
		with: {
			entityVersion: {
				columns: { updatedAt: true },
				with: {
					slug: {
						columns: { value: true },
					},
					locale: {
						columns: { languageCode: true, regionCode: true },
					},
				},
			},
		},
	});

	return items.flatMap((item) => {
		if (item.entityVersion.slug == null) {
			return [];
		}

		return [
			{
				type: "country" as const,
				slug: item.entityVersion.slug.value,
				locale: formatLocaleCode(item.entityVersion.locale),
				lastModified: item.entityVersion.updatedAt,
			},
		];
	});
}
