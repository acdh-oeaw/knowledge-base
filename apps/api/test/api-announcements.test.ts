import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { sql } from "@/services/db/sql";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

function createItem(title: string) {
	const versionId = uuidv7();
	const entityId = uuidv7();

	return {
		entity: { id: entityId },
		version: { id: versionId, entityId },
		versionId,
		entityId,
		slug: slugify(`${title} ${versionId}`),
		title,
		summary: f.lorem.paragraph(),
	};
}

/**
 * One published item of each type, with `publishedAt` dates a day apart so the expected interleaved
 * order is unambiguous: funding call (newest), opportunity, news (oldest).
 */
async function seed(db: Database) {
	const [status, asset, source, newsType, opportunityType, fundingCallType, defaultLocale] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.assets.findFirst({ columns: { id: true } }),
			db.query.opportunitySources.findFirst({ columns: { id: true } }),
			db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "news" } }),
			db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "opportunities" } }),
			db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "funding_calls" } }),
			db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
		]);

	assert(status, "No entity status in database.");
	assert(asset, "No assets in database.");
	assert(source, "No opportunity sources in database.");
	assert(newsType, "No news entity type in database.");
	assert(opportunityType, "No opportunities entity type in database.");
	assert(fundingCallType, "No funding_calls entity type in database.");
	assert(defaultLocale, "No default locale in database.");

	const newsItem = createItem("Announcement test news item");
	const opportunity = createItem("Announcement test opportunity");
	const fundingCall = createItem("Announcement test funding call");

	const newsDate = new Date("2026-03-01T00:00:00.000Z");
	const opportunityStart = new Date("2026-03-02T00:00:00.000Z");
	const fundingCallStart = new Date("2026-03-03T00:00:00.000Z");

	await db.insert(schema.entities).values([
		{ ...newsItem.entity, typeId: newsType.id },
		{ ...opportunity.entity, typeId: opportunityType.id },
		{ ...fundingCall.entity, typeId: fundingCallType.id },
	]);

	await db.insert(schema.entityVersions).values(
		[newsItem, opportunity, fundingCall].map((item) => {
			return { ...item.version, statusId: status.id, localeId: defaultLocale.id };
		}),
	);

	await db.insert(schema.slugs).values(
		[
			{ item: newsItem, typeId: newsType.id },
			{ item: opportunity, typeId: opportunityType.id },
			{ item: fundingCall, typeId: fundingCallType.id },
		].map(({ item, typeId }) => {
			return {
				entityVersionId: item.versionId,
				entityId: item.entityId,
				typeId,
				localeId: defaultLocale.id,
				isPublished: true,
				value: item.slug,
			};
		}),
	);

	await db.insert(schema.news).values({
		id: newsItem.versionId,
		title: newsItem.title,
		summary: newsItem.summary,
		publicationDate: newsDate,
		imageId: asset.id,
	});

	await db.insert(schema.opportunities).values({
		id: opportunity.versionId,
		title: opportunity.title,
		summary: opportunity.summary,
		duration: { start: opportunityStart },
		sourceId: source.id,
		website: f.internet.url(),
		imageId: asset.id,
	});

	await db.insert(schema.fundingCalls).values({
		id: fundingCall.versionId,
		title: fundingCall.title,
		summary: fundingCall.summary,
		duration: { start: fundingCallStart },
		imageId: asset.id,
	});

	return { newsItem, opportunity, fundingCall };
}

describe("announcements", () => {
	describe("GET /api/announcements", () => {
		it("should return news, opportunities and funding calls interleaved by date", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { newsItem, opportunity, fundingCall } = await seed(db);

				const response = await client.announcements.$get({
					query: { limit: "100", offset: "0" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				const seeded = data.data.filter((item) =>
					[newsItem.title, opportunity.title, fundingCall.title].includes(item.title),
				);

				expect(seeded.map((item) => item.type)).toEqual(["funding_calls", "opportunities", "news"]);
			});
		});

		it("should tag each item with its type and required card fields", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { opportunity } = await seed(db);

				const response = await client.announcements.$get({
					query: { limit: "100", offset: "0" },
				});

				const data = await response.json();

				const item = data.data.find((entry) => entry.title === opportunity.title);

				assert(item, "Seeded opportunity missing from announcements.");
				assert(item.type === "opportunities");

				expect(item).toMatchObject({
					type: "opportunities",
					summary: opportunity.summary,
					entity: { slug: opportunity.slug },
					publishedAt: "2026-03-02T00:00:00.000Z",
				});
				expect(item.image.url).toEqual(expect.any(String));
				expect(item.duration.start).toBe("2026-03-02T00:00:00.000Z");
			});
		});

		it("should filter by type", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { newsItem, opportunity, fundingCall } = await seed(db);

				const response = await client.announcements.$get({
					query: { limit: "100", offset: "0", type: ["opportunities", "funding_calls"] },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				const titles = data.data.map((item) => item.title);

				expect(titles).toContain(opportunity.title);
				expect(titles).toContain(fundingCall.title);
				expect(titles).not.toContain(newsItem.title);

				expect(data.data.every((item) => item.type !== "news")).toBe(true);
			});
		});

		it("should put featured announcements first in configured order without duplicates", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { newsItem, opportunity, fundingCall } = await seed(db);

				await db
					.insert(schema.siteMetadata)
					.values({
						id: 1,
						title: "Announcements test",
						description: "Announcements test",
						featuredItemIds: {
							news: [
								newsItem.versionId,
								fundingCall.versionId,
								newsItem.versionId,
								opportunity.versionId,
							],
							events: [],
							projects: [],
						},
					})
					.onConflictDoUpdate({
						target: schema.siteMetadata.id,
						set: {
							featuredItemIds: {
								news: [
									newsItem.versionId,
									fundingCall.versionId,
									newsItem.versionId,
									opportunity.versionId,
								],
								events: [],
								projects: [],
							},
							updatedAt: sql`NOW()`,
						},
					});

				const response = await client.announcements.$get({
					query: { limit: "3", offset: "0" },
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data.map((item) => item.id)).toEqual([
					newsItem.versionId,
					fundingCall.versionId,
					opportunity.versionId,
				]);
				expect(new Set(data.data.map((item) => item.id)).size).toBe(3);
			});
		});

		it("should paginate", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				await seed(db);

				const [first, second] = await Promise.all([
					client.announcements.$get({ query: { limit: "1", offset: "0" } }),
					client.announcements.$get({ query: { limit: "1", offset: "1" } }),
				]);

				const firstPage = await first.json();
				const secondPage = await second.json();

				expect(firstPage.data).toHaveLength(1);
				expect(secondPage.data).toHaveLength(1);
				expect(firstPage.limit).toBe(1);
				expect(secondPage.offset).toBe(1);
				expect(firstPage.total).toBe(secondPage.total);
				expect(firstPage.data[0]?.id).not.toBe(secondPage.data[0]?.id);
			});
		});
	});
});
