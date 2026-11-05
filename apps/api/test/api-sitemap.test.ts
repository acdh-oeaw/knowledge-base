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
	/** Locale of the version; defaults to the default locale. */
	localeId?: string;
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
	const localeId = params.localeId ?? defaultLocale.id;

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

async function seedOrganisationalUnit(
	db: Database,
	type: "institution" | "national_consortium",
	slug: string,
	params: SeedParams = {},
) {
	const { entityId, versionId } = await seedDocument(db, "organisational_units", slug, params);

	const unitType = await db.query.organisationalUnitTypes.findFirst({
		columns: { id: true },
		where: { type },
	});

	assert(unitType, "No organisational unit type in database.");

	await db.insert(schema.organisationalUnits).values({
		id: versionId,
		name: f.lorem.words(),
		typeId: unitType.id,
	});

	return { entityId };
}

async function seedConsortiumMember(
	db: Database,
	slug: string,
	params: SeedParams & { membershipEnd?: Date } = {},
) {
	const { membershipEnd, ...seedParams } = params;

	const [member, consortium, unitStatus] = await Promise.all([
		seedOrganisationalUnit(db, "institution", slug, seedParams),
		seedOrganisationalUnit(db, "national_consortium", `consortium-${uuidv7()}`),
		db.query.organisationalUnitStatus.findFirst({
			columns: { id: true },
			where: { status: "is_member_of" },
		}),
	]);

	assert(unitStatus, "No organisational unit status in database.");

	await db.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: member.entityId,
		relatedUnitDocumentId: consortium.entityId,
		status: unitStatus.id,
		duration: { start: f.date.past({ years: 5, refDate: "2020-01-01" }), end: membershipEnd },
	});

	return member;
}

function findEntry(entries: Array<SitemapEntry>, href: string) {
	return entries.filter((entry) => entry.href === href);
}

async function getDefaultLocaleCode(db: Database): Promise<string> {
	const locale = await db.query.locales.findFirst({
		where: { isDefault: true },
		columns: { languageCode: true, regionCode: true },
	});

	assert(locale, "No default locale in database.");

	return locale.regionCode != null
		? `${locale.languageCode}-${locale.regionCode}`
		: locale.languageCode;
}

async function insertTestLocale(db: Database) {
	const [locale] = await db
		.insert(schema.locales)
		.values({ languageCode: "zz", name: "Test locale", isDefault: false })
		.returning({ id: schema.locales.id });

	assert(locale, "Failed to insert test locale.");

	return locale;
}

describe("sitemap", () => {
	describe("GET /api/sitemap", () => {
		it("should return a locale-prefixed url per published document", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);

				const slug = `news-item-${uuidv7()}`;
				const updatedAt = new Date("2030-01-02T03:04:05.000Z");
				await seedNewsItem(db, slug, { updatedAt });

				const memberSlug = `institution-${uuidv7()}`;
				await seedConsortiumMember(db, memberSlug);

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data).toEqual(
					expect.arrayContaining([
						{
							href: `/${localeCode}/news/${slug}`,
							locale: localeCode,
							type: "news",
							lastModified: updatedAt.toISOString(),
							alternates: [{ locale: localeCode, href: `/${localeCode}/news/${slug}` }],
						},
						expect.objectContaining({
							href: `/${localeCode}/consortium/${memberSlug}`,
							locale: localeCode,
							type: "institution",
						}),
					]),
				);

				expect(data.total).toBe(data.data.length);
			});
		});

		it("should return a separate entry per locale a document is published in", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const defaultLocaleCode = await getDefaultLocaleCode(db);
				const otherLocale = await insertTestLocale(db);

				const slug = `news-item-${uuidv7()}`;
				const { entityId } = await seedDocument(db, "news", slug);
				const [status, newsType] = await Promise.all([
					db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
					db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "news" } }),
				]);
				assert(status, "No entity status in database.");
				assert(newsType, "No news entity type in database.");

				const translatedVersionId = uuidv7();
				const translatedSlug = `${slug}-zz`;

				await db.insert(schema.entityVersions).values({
					id: translatedVersionId,
					entityId,
					statusId: status.id,
					localeId: otherLocale.id,
				});
				await db.insert(schema.slugs).values({
					entityVersionId: translatedVersionId,
					entityId,
					typeId: newsType.id,
					localeId: otherLocale.id,
					isPublished: true,
					value: translatedSlug,
				});
				await db.insert(schema.news).values({
					id: translatedVersionId,
					title: f.lorem.sentence(),
					summary: f.lorem.paragraph(),
					publicationDate: f.date.past(),
					imageId: (await db.query.assets.findFirst({ columns: { id: true } }))!.id,
				});

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				/** Both entries reference each other and themselves, each with its own locale's slug. */
				const alternates = [
					{ locale: defaultLocaleCode, href: `/${defaultLocaleCode}/news/${slug}` },
					{ locale: "zz", href: `/zz/news/${translatedSlug}` },
				].toSorted((a, z) => (a.locale < z.locale ? -1 : a.locale > z.locale ? 1 : 0));

				expect(findEntry(data.data, `/${defaultLocaleCode}/news/${slug}`)).toEqual([
					expect.objectContaining({ locale: defaultLocaleCode, type: "news", alternates }),
				]);
				expect(findEntry(data.data, `/zz/news/${translatedSlug}`)).toEqual([
					expect.objectContaining({ locale: "zz", type: "news", alternates }),
				]);
			});
		});

		it("should not return unpublished documents", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);

				const slug = `news-item-${uuidv7()}`;
				await seedNewsItem(db, slug, { status: "draft" });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(findEntry(data.data, `/${localeCode}/news/${slug}`)).toEqual([]);
			});
		});

		it("should collapse documents which share a url into a single entry", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);

				/** Future timestamps, so the newest of the two is the newest in the database. */
				const older = new Date("2030-01-01T00:00:00.000Z");
				const newer = new Date("2031-01-01T00:00:00.000Z");

				await seedPage(db, "projects", { updatedAt: older });
				await seedPage(db, "projekte", { updatedAt: newer });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				/** Both pages back the same listing page ... */
				expect(findEntry(data.data, `/${localeCode}/projects`)).toEqual([
					{
						href: `/${localeCode}/projects`,
						locale: localeCode,
						type: "pages",
						/** ... which is only as old as its newest document. */
						lastModified: newer.toISOString(),
						/** Other published documents may add further locales, so only require this one. */
						// oxlint-disable-next-line typescript/no-unsafe-assignment
						alternates: expect.arrayContaining([
							{ locale: localeCode, href: `/${localeCode}/projects` },
						]),
					},
				]);
			});
		});

		it("should merge the alternates of documents which share a url", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);
				const otherLocale = await insertTestLocale(db);

				/** Two unrelated documents, one per locale, backing the same listing page. */
				await seedPage(db, "projects");
				await seedPage(db, "projekte", { localeId: otherLocale.id });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				/** Other published documents may add further locales, so only require these two. */
				const alternates: unknown = expect.arrayContaining([
					{ locale: localeCode, href: `/${localeCode}/projects` },
					{ locale: "zz", href: "/zz/projects" },
				]);

				expect(findEntry(data.data, `/${localeCode}/projects`)).toEqual([
					expect.objectContaining({ alternates }),
				]);
				expect(findEntry(data.data, "/zz/projects")).toEqual([
					expect.objectContaining({ alternates }),
				]);
			});
		});

		it("should resolve pages to their own url", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);

				const slug = `page-${uuidv7()}`;
				await seedPage(db, slug);

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(findEntry(data.data, `/${localeCode}/pages/${slug}`)).toEqual([
					expect.objectContaining({ href: `/${localeCode}/pages/${slug}`, type: "pages" }),
				]);
				expect(data.unresolved).toBe(0);
			});
		});

		it("should link the locale versions of a consortium member", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const localeCode = await getDefaultLocaleCode(db);
				const otherLocale = await insertTestLocale(db);

				const slug = `institution-${uuidv7()}`;
				const { entityId } = await seedConsortiumMember(db, slug);

				const otherSlug = `institution-${uuidv7()}`;
				const [status, entityType, unitType] = await Promise.all([
					db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
					db.query.entityTypes.findFirst({
						columns: { id: true },
						where: { type: "organisational_units" },
					}),
					db.query.organisationalUnitTypes.findFirst({
						columns: { id: true },
						where: { type: "institution" },
					}),
				]);

				assert(status, "No entity status in database.");
				assert(entityType, "No entity type in database.");
				assert(unitType, "No organisational unit type in database.");

				const versionId = uuidv7();

				await db
					.insert(schema.entityVersions)
					.values({ id: versionId, entityId, statusId: status.id, localeId: otherLocale.id });
				await db.insert(schema.slugs).values({
					entityVersionId: versionId,
					entityId,
					typeId: entityType.id,
					localeId: otherLocale.id,
					isPublished: true,
					value: otherSlug,
				});
				await db
					.insert(schema.organisationalUnits)
					.values({ id: versionId, name: f.lorem.words(), typeId: unitType.id });

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(findEntry(data.data, `/${localeCode}/consortium/${slug}`)).toEqual([
					expect.objectContaining({
						alternates: [
							{ locale: localeCode, href: `/${localeCode}/consortium/${slug}` },
							{ locale: "zz", href: `/zz/consortium/${otherSlug}` },
						].toSorted((a, z) => (a.locale < z.locale ? -1 : 1)),
					}),
				]);
			});
		});

		it("should not return institutions which are not consortium members", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const unrelatedSlug = `institution-${uuidv7()}`;
				await seedOrganisationalUnit(db, "institution", unrelatedSlug);

				const formerMemberSlug = `institution-${uuidv7()}`;
				await seedConsortiumMember(db, formerMemberSlug, {
					membershipEnd: new Date("2021-01-01T00:00:00.000Z"),
				});

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();
				const hrefs = data.data.map((entry) => entry.href);

				expect(hrefs.filter((href) => href.endsWith(unrelatedSlug))).toEqual([]);
				expect(hrefs.filter((href) => href.endsWith(formerMemberSlug))).toEqual([]);
			});
		});

		it("should not return types with no page on the website", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const slug = `person-${uuidv7()}`;
				await seedDocument(db, "persons", slug);

				const response = await client.sitemap.$get();

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.data.filter((entry) => entry.href.endsWith(slug))).toEqual([]);
				expect(data.unresolved).toBe(0);
			});
		});
	});
});
