import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { SitemapEntry } from "@/routes/sitemap/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

type EntityStatus = (typeof schema.entityStatusEnum)[number];

interface SeedParams {
	status?: EntityStatus;
	/** Publish timestamp of the version, i.e. the entry's `lastModified`. */
	updatedAt?: Date;
}

async function seedDocument(
	db: Database,
	type: (typeof schema.entityTypesEnum)[number],
	slug: string,
	params: SeedParams = {},
) {
	const { status: statusType = "published", updatedAt } = params;

	const [status, entityType, asset, defaultLocale] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: statusType } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type } }),
		db.query.assets.findFirst({ columns: { id: true } }),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(asset, "No assets in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	const entityId = uuidv7();
	const versionId = uuidv7();

	await db.insert(schema.entities).values({ id: entityId, typeId: entityType.id });
	await db
		.insert(schema.entityVersions)
		.values({ id: versionId, entityId, statusId: status.id, localeId, updatedAt });
	await db.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId,
		typeId: entityType.id,
		localeId,
		isPublished: statusType === "published",
		value: slug,
	});

	return { entityId, versionId, assetId: asset.id };
}

async function seedNewsItem(db: Database, slug: string, params: SeedParams = {}) {
	const { versionId, assetId } = await seedDocument(db, "news", slug, params);

	await db.insert(schema.news).values({
		id: versionId,
		title: f.lorem.sentence(),
		summary: f.lorem.paragraph(),
		publicationDate: f.date.past(),
		imageId: assetId,
	});
}

async function seedPage(db: Database, slug: string, params: SeedParams = {}) {
	const { versionId } = await seedDocument(db, "pages", slug, params);

	await db.insert(schema.pages).values({
		id: versionId,
		title: f.lorem.sentence(),
		summary: f.lorem.paragraph(),
		publicationDate: f.date.past(),
	});
}

async function seedDocumentOrPolicy(db: Database, slug: string, params: SeedParams = {}) {
	const { versionId, assetId } = await seedDocument(db, "documents_policies", slug, params);

	await db.insert(schema.documentsPolicies).values({
		id: versionId,
		title: f.lorem.sentence(),
		documentId: assetId,
	});
}

async function seedWorkingGroup(db: Database, slug: string, params: SeedParams = {}) {
	const { entityId, versionId } = await seedDocument(db, "organisational_units", slug, params);

	const [type, unitStatus, umbrella] = await Promise.all([
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "working_group" },
		}),
		db.query.organisationalUnitStatus.findFirst({
			columns: { id: true },
			where: { status: "is_part_of" },
		}),
		db.query.organisationalUnits.findFirst({
			columns: { id: true },
			where: { entityVersion: { slug: { value: "dariah-eu" } }, type: { type: "eric" } },
			with: { entityVersion: { columns: { entityId: true } } },
		}),
	]);

	assert(type, "No organisational unit type in database.");
	assert(unitStatus, "No organisational unit status in database.");
	assert(umbrella, "No DARIAH-EU organisational unit in database.");

	await db.insert(schema.organisationalUnits).values({
		id: versionId,
		name: f.lorem.words(),
		typeId: type.id,
	});

	/** The `working_groups` view — and so the working groups endpoint — only sees related units. */
	await db.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: entityId,
		relatedUnitDocumentId: umbrella.entityVersion.entityId,
		status: unitStatus.id,
		duration: { start: f.date.past({ years: 5 }) },
	});
}

function findEntry(entries: Array<SitemapEntry>, href: string) {
	return entries.filter((entry) => entry.href === href);
}

describe("sitemap", () => {
	describe("GET /api/sitemap", () => {
		it("should return a url per published document", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const slug = `news-item-${uuidv7()}`;
				const updatedAt = new Date("2030-01-02T03:04:05.000Z");
				await seedNewsItem(db, slug, { updatedAt });

				const workingGroupSlug = `working-group-${uuidv7()}`;
				await seedWorkingGroup(db, workingGroupSlug);

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([
						{
							href: `/news/${slug}`,
							type: "news",
							lastModified: updatedAt.toISOString(),
						},
						expect.objectContaining({
							href: `/network/working-groups/${workingGroupSlug}`,
							type: "working_group",
						}),
					]),
				);

				expect(data.total).toBe(data.data.length);
			});
		});

		it("should not return unpublished documents", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const slug = `news-item-${uuidv7()}`;
				await seedNewsItem(db, slug, { status: "draft" });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(findEntry(data.data, `/news/${slug}`)).toEqual([]);
			});
		});

		it("should collapse documents which share a url into a single entry", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				/** Future timestamps, so the newest of the two is the newest in the database. */
				const older = new Date("2030-01-01T00:00:00.000Z");
				const newer = new Date("2031-01-01T00:00:00.000Z");

				await seedDocumentOrPolicy(db, `document-${uuidv7()}`, { updatedAt: older });
				await seedDocumentOrPolicy(db, `document-${uuidv7()}`, { updatedAt: newer });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				/** Every document and policy is surfaced on the same page ... */
				expect(findEntry(data.data, "/about/documents")).toEqual([
					{
						href: "/about/documents",
						type: "documents_policies",
						/** ... which is only as old as its newest document. */
						lastModified: newer.toISOString(),
					},
				]);
			});
		});

		it("should resolve pages through the interim slug to path map", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				await seedPage(db, "strategy");

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(findEntry(data.data, "/about/strategy")).toEqual([
					expect.objectContaining({ href: "/about/strategy", type: "pages" }),
				]);
			});
		});

		it("should count pages with no known website path as unresolved", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const before = await (await client.sitemap.$get()).json();

				const slug = `unmapped-page-${uuidv7()}`;
				await seedPage(db, slug);

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.unresolved).toBe(before.unresolved + 1);
				expect(data.total).toBe(before.total);
			});
		});
	});
});
