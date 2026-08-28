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
		entity: { id: entityId, slug: slugify(`${title} ${versionId}`) },
		version: { id: versionId, entityId },
		versionId,
		title,
		summary: f.lorem.paragraph(),
	};
}

async function seedAnnouncements(db: Database) {
	const [
		status,
		asset,
		source,
		newsType,
		opportunityType,
		fundingCallType,
		eventType,
		defaultLocale,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.opportunitySources.findFirst({ columns: { id: true } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "news" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "opportunities" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "funding_calls" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "events" } }),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(asset, "No assets in database.");
	assert(source, "No opportunity sources in database.");
	assert(newsType, "No news entity type in database.");
	assert(opportunityType, "No opportunities entity type in database.");
	assert(fundingCallType, "No funding_calls entity type in database.");
	assert(eventType, "No events entity type in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	const newsItem = createItem("Featured announcement test news item");
	const opportunity = createItem("Featured announcement test opportunity");
	const fundingCall = createItem("Featured announcement test funding call");
	const event = createItem("Featured entity test event");

	await db.insert(schema.entities).values([
		{ id: newsItem.entity.id, typeId: newsType.id },
		{ id: opportunity.entity.id, typeId: opportunityType.id },
		{ id: fundingCall.entity.id, typeId: fundingCallType.id },
		{ id: event.entity.id, typeId: eventType.id },
	]);

	await db.insert(schema.entityVersions).values(
		[newsItem, opportunity, fundingCall, event].map((item) => {
			return { ...item.version, statusId: status.id, localeId };
		}),
	);

	await db.insert(schema.slugs).values(
		[
			{ item: newsItem, typeId: newsType.id },
			{ item: opportunity, typeId: opportunityType.id },
			{ item: fundingCall, typeId: fundingCallType.id },
			{ item: event, typeId: eventType.id },
		].map(({ item, typeId }) => {
			return {
				entityVersionId: item.versionId,
				entityId: item.entity.id,
				typeId,
				localeId,
				isPublished: true,
				value: item.entity.slug,
			};
		}),
	);

	await db.insert(schema.news).values({
		id: newsItem.versionId,
		title: newsItem.title,
		summary: newsItem.summary,
		publicationDate: new Date("2026-04-01T00:00:00.000Z"),
		imageId: asset.id,
	});

	await db.insert(schema.opportunities).values({
		id: opportunity.versionId,
		title: opportunity.title,
		summary: opportunity.summary,
		duration: { start: new Date("2026-04-02T00:00:00.000Z") },
		sourceId: source.id,
		website: f.internet.url(),
		imageId: asset.id,
	});

	await db.insert(schema.fundingCalls).values({
		id: fundingCall.versionId,
		title: fundingCall.title,
		summary: fundingCall.summary,
		duration: { start: new Date("2026-04-03T00:00:00.000Z") },
		imageId: asset.id,
	});

	await db.insert(schema.events).values({
		id: event.versionId,
		title: event.title,
		summary: event.summary,
		location: "Online",
		duration: { start: new Date("2026-04-04T00:00:00.000Z") },
		isFullDay: false,
		imageId: asset.id,
	});

	return { newsItem, opportunity, fundingCall, event };
}

describe("featured entities", () => {
	describe("GET /api/featured-entities", () => {
		it("should return featured news as mixed announcements in configured order", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { newsItem, opportunity, fundingCall, event } = await seedAnnouncements(db);

				await db
					.insert(schema.siteMetadata)
					.values({
						id: 1,
						title: "Featured entities test",
						description: "Featured entities test",
						featuredItemIds: {
							news: [opportunity.versionId, fundingCall.versionId, newsItem.versionId],
							events: [event.versionId],
						},
					})
					.onConflictDoUpdate({
						target: schema.siteMetadata.id,
						set: {
							featuredItemIds: {
								news: [opportunity.versionId, fundingCall.versionId, newsItem.versionId],
								events: [event.versionId],
							},
							updatedAt: sql`NOW()`,
						},
					});

				const response = await client["featured-entities"].$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data.news.map((item) => item.type)).toEqual([
					"opportunities",
					"funding_calls",
					"news",
				]);
				expect(data.data.news.map((item) => item.id)).toEqual([
					opportunity.versionId,
					fundingCall.versionId,
					newsItem.versionId,
				]);
				expect(data.data.events.map((item) => item.type)).toEqual(["events"]);
				expect(data.data.events.map((item) => item.id)).toEqual([event.versionId]);
			});
		});
	});
});
