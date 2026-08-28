/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { serializeDateRange } from "@/lib/date-range";
import { generateImageUrl, imageAssetColumns, withResolvedCaption } from "@/lib/images";
import type { Database, Transaction } from "@/middlewares/db";
import {
	type Announcement,
	type AnnouncementType,
	announcementTypeValues,
} from "@/routes/announcements/schemas";
import { type SQL, count, eq, sql } from "@/services/db/sql";
import { imageWidth } from "~/config/api.config";

interface GetAnnouncementsParams {
	/** @default 10 */
	limit?: number;
	/** @default 0 */
	offset?: number;
	type?: AnnouncementType | Array<AnnouncementType>;
}

const entityVersionColumns = {
	columns: { updatedAt: true },
	with: {
		slug: {
			columns: { value: true },
		},
	},
} as const;

/**
 * Featured announcements followed by news, opportunities and funding calls interleaved into a
 * single reverse-chronological feed, for consumers rendering one overview page across all three.
 *
 * The three tables share no columns to sort by, so the page is selected by a `UNION ALL` of just
 * `(id, type, publishedAt)` — with featured ids ranked before ordering, limiting and offsetting in
 * the database — and only the resulting page is hydrated with its images and relations. Merging
 * full rows in application code instead would have to over-fetch `offset + limit` rows from every
 * table to stay correct.
 */
export async function getAnnouncements(db: Database | Transaction, params: GetAnnouncementsParams) {
	const { limit = 10, offset = 0, type } = params;

	const requested = type == null ? [] : Array.isArray(type) ? type : [type];
	const types = requested.length > 0 ? requested : [...announcementTypeValues];
	const metadata = await db.query.siteMetadata.findFirst({
		columns: {
			featuredItemIds: true,
		},
	});
	const featuredIds = [...new Set(metadata?.featuredItemIds?.news ?? [])];

	/**
	 * One `(id, type, published_at)` branch per type, published-only via the same lifecycle join the
	 * per-type endpoints count with.
	 */
	const branches = {
		news: sql`
			SELECT ${schema.news.id} AS id, 'news' AS type, ${schema.news.publicationDate} AS published_at
			FROM ${schema.news}
			INNER JOIN ${schema.entityVersions} ON ${schema.news.id} = ${schema.entityVersions.id}
			INNER JOIN ${schema.documentLifecycle} ON ${schema.documentLifecycle.publishedId} = ${schema.entityVersions.id}
		`,
		opportunities: sql`
			SELECT ${schema.opportunities.id} AS id, 'opportunities' AS type, LOWER(${schema.opportunities.duration}) AS published_at
			FROM ${schema.opportunities}
			INNER JOIN ${schema.entityVersions} ON ${schema.opportunities.id} = ${schema.entityVersions.id}
			INNER JOIN ${schema.documentLifecycle} ON ${schema.documentLifecycle.publishedId} = ${schema.entityVersions.id}
		`,
		funding_calls: sql`
			SELECT ${schema.fundingCalls.id} AS id, 'funding_calls' AS type, LOWER(${schema.fundingCalls.duration}) AS published_at
			FROM ${schema.fundingCalls}
			INNER JOIN ${schema.entityVersions} ON ${schema.fundingCalls.id} = ${schema.entityVersions.id}
			INNER JOIN ${schema.documentLifecycle} ON ${schema.documentLifecycle.publishedId} = ${schema.entityVersions.id}
		`,
	} satisfies Record<AnnouncementType, SQL>;

	const totals = {
		news: () =>
			db
				.select({ total: count() })
				.from(schema.news)
				.innerJoin(schema.entityVersions, eq(schema.news.id, schema.entityVersions.id))
				.innerJoin(
					schema.documentLifecycle,
					eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
				),
		opportunities: () =>
			db
				.select({ total: count() })
				.from(schema.opportunities)
				.innerJoin(schema.entityVersions, eq(schema.opportunities.id, schema.entityVersions.id))
				.innerJoin(
					schema.documentLifecycle,
					eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
				),
		funding_calls: () =>
			db
				.select({ total: count() })
				.from(schema.fundingCalls)
				.innerJoin(schema.entityVersions, eq(schema.fundingCalls.id, schema.entityVersions.id))
				.innerJoin(
					schema.documentLifecycle,
					eq(schema.documentLifecycle.publishedId, schema.entityVersions.id),
				),
	} satisfies Record<AnnouncementType, unknown>;

	const selected = types.map((t) => branches[t]);
	const featuredOrder =
		featuredIds.length > 0
			? sql`CASE id ${sql.join(
					featuredIds.map((id, index) => sql`WHEN ${id} THEN ${index}::integer`),
					sql` `,
				)} ELSE ${featuredIds.length}::integer END`
			: sql`0::integer`;

	const [result, aggregates] = await Promise.all([
		// Formatted to ISO here because `execute` returns raw driver values rather than mapped
		// columns, so `published_at` would arrive as an unparsed string. Ordering still uses the
		// untouched timestamp, and `id` breaks ties so paging stays stable across equal dates.
		db.execute<{ id: string; type: AnnouncementType; published_at_iso: string }>(sql`
			SELECT
				id,
				type,
				to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at_iso
			FROM (${sql.join(selected, sql` UNION ALL `)}) AS announcements
			ORDER BY ${featuredOrder}, published_at DESC, id DESC
			LIMIT ${limit} OFFSET ${offset}
		`),
		Promise.all(
			types.map(async (t) => {
				const [aggregate] = await totals[t]();
				return aggregate?.total ?? 0;
			}),
		),
	]);

	const page = result.rows;

	const total = aggregates.reduce((sum, value) => sum + value, 0);

	const idsByType = {
		news: [] as Array<string>,
		opportunities: [] as Array<string>,
		funding_calls: [] as Array<string>,
	};

	for (const row of page) {
		idsByType[row.type].push(row.id);
	}

	const [news, opportunities, fundingCalls] = await Promise.all([
		idsByType.news.length > 0
			? db.query.news.findMany({
					where: { id: { in: idsByType.news } },
					columns: {
						id: true,
						title: true,
						summary: true,
						imageCaption: true,
						imageCaptionMode: true,
					},
					with: { entityVersion: entityVersionColumns, image: imageAssetColumns },
				})
			: [],
		idsByType.opportunities.length > 0
			? db.query.opportunities.findMany({
					where: { id: { in: idsByType.opportunities } },
					columns: {
						id: true,
						title: true,
						summary: true,
						duration: true,
						website: true,
						imageCaption: true,
						imageCaptionMode: true,
					},
					with: {
						entityVersion: entityVersionColumns,
						image: imageAssetColumns,
						source: { columns: { source: true } },
					},
				})
			: [],
		idsByType.funding_calls.length > 0
			? db.query.fundingCalls.findMany({
					where: { id: { in: idsByType.funding_calls } },
					columns: {
						id: true,
						title: true,
						summary: true,
						duration: true,
						imageCaption: true,
						imageCaptionMode: true,
					},
					with: { entityVersion: entityVersionColumns, image: imageAssetColumns },
				})
			: [],
	]);

	const newsById = new Map(news.map((item) => [item.id, item] as const));
	const opportunitiesById = new Map(opportunities.map((item) => [item.id, item] as const));
	const fundingCallsById = new Map(fundingCalls.map((item) => [item.id, item] as const));

	const data = page.flatMap((row): Array<Announcement> => {
		const publishedAt = row.published_at_iso;

		switch (row.type) {
			case "news": {
				const item = newsById.get(row.id);
				if (item?.entityVersion.slug == null) {
					return [];
				}

				return [
					{
						type: "news" as const,
						id: item.id,
						title: item.title,
						summary: item.summary,
						image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
						entity: { slug: item.entityVersion.slug.value },
						publishedAt,
					},
				];
			}
			case "opportunities": {
				const item = opportunitiesById.get(row.id);
				if (item?.entityVersion.slug == null) {
					return [];
				}

				return [
					{
						type: "opportunities" as const,
						id: item.id,
						title: item.title,
						summary: item.summary,
						image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
						entity: { slug: item.entityVersion.slug.value },
						publishedAt,
						duration: serializeDateRange(item.duration),
						source: item.source.source,
						website: item.website,
					},
				];
			}
			case "funding_calls": {
				const item = fundingCallsById.get(row.id);
				if (item?.entityVersion.slug == null) {
					return [];
				}

				return [
					{
						type: "funding_calls" as const,
						id: item.id,
						title: item.title,
						summary: item.summary,
						image: generateImageUrl(withResolvedCaption(item.image, item), imageWidth.preview),
						entity: { slug: item.entityVersion.slug.value },
						publishedAt,
						duration: serializeDateRange(item.duration),
					},
				];
			}
		}
	});

	return { data, limit, offset, total };
}
