/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { getWebsiteHref } from "@/lib/website-routes";
import type { Database, Transaction } from "@/middlewares/db";
import type { SitemapEntityType } from "@/routes/sitemap/schemas";
import { and, eq, inArray, isNotNull } from "@/services/db/sql";

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

interface SitemapSource {
	type: SitemapEntityType;
	slug: string;
	lastModified: Date;
}

/**
 * Every website url that can be derived from published content, one entry per url.
 *
 * Deliberately unpaginated: the payload is one href and one timestamp per public document (a few
 * thousand today, far below the 50.000-url sitemap limit), and a sitemap that arrives in pages is a
 * sitemap the consumer can assemble incorrectly.
 */
export async function getSitemap(db: Database | Transaction) {
	const [documents, workingGroups, countries] = await Promise.all([
		getPublishedDocuments(db),
		getPublishedWorkingGroups(db),
		getPublishedCountries(db),
	]);

	/**
	 * Keyed by href, not by document: several documents can share a url — every document and policy
	 * is surfaced on `/about/documents` — and such a url is only as old as its newest document.
	 */
	const entries = new Map<string, SitemapSource & { href: string }>();
	let unresolved = 0;

	for (const source of [...documents, ...workingGroups, ...countries]) {
		const href = getWebsiteHref(source.type, { slug: source.slug });

		if (href == null) {
			unresolved += 1;
			continue;
		}

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
				type: entry.type,
				lastModified: entry.lastModified.toISOString(),
			};
		});

	return { data, total: data.length, unresolved };
}

/**
 * Read across all entity types at once, rather than per type: the lifecycle view already knows
 * which documents have a published version and when it was published, and the sitemap needs nothing
 * from the subtype tables.
 */
async function getPublishedDocuments(db: Database | Transaction): Promise<Array<SitemapSource>> {
	const rows = await db
		.select({
			type: schema.entityTypes.type,
			slug: schema.slugs.value,
			lastModified: schema.documentLifecycle.publishedUpdatedAt,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.documentLifecycle.publishedId))
		.where(
			and(
				inArray(schema.entityTypes.type, documentEntityTypes),
				// `published_updated_at` is set exactly when a published version exists.
				isNotNull(schema.documentLifecycle.publishedId),
			),
		);

	return rows.flatMap((row) => {
		if (row.lastModified == null || !isDocumentEntityType(row.type)) {
			return [];
		}

		return [{ type: row.type, slug: row.slug, lastModified: row.lastModified }];
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
				lastModified: item.entityVersion.updatedAt,
			},
		];
	});
}
