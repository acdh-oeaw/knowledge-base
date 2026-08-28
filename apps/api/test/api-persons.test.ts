import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { Person } from "@/routes/persons/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

function createItems(count: number) {
	const items = f.helpers.multiple(
		() => {
			const versionId = uuidv7();
			const entityId = uuidv7();
			const assetId = uuidv7();
			const name = f.person.fullName();
			const slug = slugify(name);
			const affiliationVersionId = uuidv7();
			const affiliationEntityId = uuidv7();
			const affiliationName = f.company.name();
			const affiliationSlug = slugify(affiliationName);

			const entity = { id: entityId, slug };
			const version = { id: versionId, entityId };

			const asset = {
				id: assetId,
				key: `persons/${assetId}.jpg`,
				label: name,
				mimeType: "image/jpeg",
			};

			const person = {
				id: versionId,
				name,
				sortName: f.person.lastName(),
				email: f.internet.email(),
				orcid: `0000-000${String(f.number.int({ min: 1, max: 9 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}`,
				imageId: assetId,
			};

			const affiliation = {
				entity: { id: affiliationEntityId, slug: affiliationSlug },
				version: { id: affiliationVersionId, entityId: affiliationEntityId },
				organisationalUnit: {
					id: affiliationVersionId,
					name: affiliationName,
					summary: f.lorem.paragraph(),
				},
				description: f.lorem.sentence(),
			};

			return { entity, version, asset, person, affiliation };
		},
		{ count },
	);

	return items;
}

async function seed(db: Database, items: ReturnType<typeof createItems>) {
	const [
		status,
		entityType,
		organisationalUnitType,
		institutionType,
		affiliatedRoleType,
		defaultLocale,
	] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({ columns: { id: true }, where: { type: "persons" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findFirst({
			columns: { id: true },
			where: { type: "institution" },
		}),
		db.query.personRoleTypes.findFirst({
			columns: { id: true },
			where: { type: "is_affiliated_with" },
		}),
		db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
	]);

	assert(status, "No entity status in database.");
	assert(entityType, "No entity type in database.");
	assert(organisationalUnitType, "No organisational unit entity type in database.");
	assert(institutionType, "No institution type in database.");
	assert(affiliatedRoleType, "No affiliated role type in database.");
	assert(defaultLocale, "No default locale in database.");
	const localeId = defaultLocale.id;

	await db.insert(schema.assets).values(items.map((item) => item.asset));

	await db.insert(schema.entities).values(
		items.map((item) => {
			return { id: item.entity.id, typeId: entityType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.map((item) => {
			return { ...item.version, statusId: status.id, localeId };
		}),
	);

	await db.insert(schema.slugs).values(
		items.map((item) => {
			return {
				entityVersionId: item.version.id,
				entityId: item.entity.id,
				typeId: entityType.id,
				localeId,
				isPublished: true,
				value: item.entity.slug,
			};
		}),
	);

	await db.insert(schema.persons).values(items.map((item) => item.person));

	await db.insert(schema.entities).values(
		items.map((item) => {
			return { id: item.affiliation.entity.id, typeId: organisationalUnitType.id };
		}),
	);

	await db.insert(schema.entityVersions).values(
		items.map((item) => {
			return { ...item.affiliation.version, statusId: status.id, localeId };
		}),
	);

	await db.insert(schema.slugs).values(
		items.map((item) => {
			return {
				entityVersionId: item.affiliation.version.id,
				entityId: item.affiliation.entity.id,
				typeId: organisationalUnitType.id,
				localeId,
				isPublished: true,
				value: item.affiliation.entity.slug,
			};
		}),
	);

	await db.insert(schema.organisationalUnits).values(
		items.map((item) => {
			return { ...item.affiliation.organisationalUnit, typeId: institutionType.id };
		}),
	);

	await db.insert(schema.personsToOrganisationalUnits).values(
		items.map((item) => {
			return {
				personDocumentId: item.entity.id,
				organisationalUnitDocumentId: item.affiliation.entity.id,
				roleTypeId: affiliatedRoleType.id,
				duration: { start: f.date.past({ years: 5 }) },
				description: item.affiliation.description,
			};
		}),
	);

	await Promise.all(
		items.map((item) => seedContentBlock(db, item.version.id, entityType.id, "biography")),
	);
}

/**
 * Seeds one published spotlight article, one published impact case study, and one _draft_ spotlight
 * article, all crediting `personEntityId` (a document id).
 */
async function seedContributions(db: Database, personEntityId: string) {
	const [publishedStatus, draftStatus, spotlightArticleType, impactCaseStudyType, defaultLocale] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "draft" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "spotlight_articles" },
			}),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "impact_case_studies" },
			}),
			db.query.locales.findFirst({ columns: { id: true }, where: { isDefault: true } }),
		]);

	assert(publishedStatus, "No published entity status in database.");
	assert(draftStatus, "No draft entity status in database.");
	assert(spotlightArticleType, "No spotlight article entity type in database.");
	assert(impactCaseStudyType, "No impact case study entity type in database.");
	assert(defaultLocale);
	const localeId = defaultLocale.id;

	function createArticle(typeId: string, statusId: string, publicationDate: Date) {
		const versionId = uuidv7();
		const entityId = uuidv7();
		const assetId = uuidv7();
		const title = f.lorem.sentence();

		return {
			entity: { id: entityId, slug: slugify(title), typeId },
			version: { id: versionId, entityId, statusId, localeId },
			asset: {
				id: assetId,
				key: `articles/${assetId}.jpg`,
				label: title,
				mimeType: "image/jpeg",
			},
			article: {
				id: versionId,
				title,
				summary: f.lorem.paragraph(),
				publicationDate,
				imageId: assetId,
			},
		};
	}

	const spotlightArticle = createArticle(
		spotlightArticleType.id,
		publishedStatus.id,
		new Date("2026-03-01T00:00:00.000Z"),
	);
	const draftSpotlightArticle = createArticle(
		spotlightArticleType.id,
		draftStatus.id,
		new Date("2026-04-01T00:00:00.000Z"),
	);
	const impactCaseStudy = createArticle(
		impactCaseStudyType.id,
		publishedStatus.id,
		new Date("2026-01-01T00:00:00.000Z"),
	);

	const articles = [spotlightArticle, draftSpotlightArticle, impactCaseStudy];

	await db.insert(schema.assets).values(articles.map((item) => item.asset));
	await db.insert(schema.entities).values(
		articles.map((item) => {
			return { id: item.entity.id, typeId: item.entity.typeId };
		}),
	);
	await db.insert(schema.entityVersions).values(articles.map((item) => item.version));

	await db.insert(schema.slugs).values(
		articles.map((item) => {
			return {
				entityVersionId: item.version.id,
				entityId: item.entity.id,
				typeId: item.entity.typeId,
				localeId,
				isPublished: item.version.statusId === publishedStatus.id,
				value: item.entity.slug,
			};
		}),
	);

	await db
		.insert(schema.spotlightArticles)
		.values([spotlightArticle.article, draftSpotlightArticle.article]);
	await db.insert(schema.impactCaseStudies).values([impactCaseStudy.article]);

	await db.insert(schema.spotlightArticlesToPersons).values(
		[spotlightArticle, draftSpotlightArticle].map((item) => {
			return {
				spotlightArticleDocumentId: item.entity.id,
				personDocumentId: personEntityId,
				role: "author" as const,
			};
		}),
	);

	await db.insert(schema.impactCaseStudiesToPersons).values([
		{
			impactCaseStudyDocumentId: impactCaseStudy.entity.id,
			personDocumentId: personEntityId,
			role: "editor" as const,
		},
	]);

	return { spotlightArticle, draftSpotlightArticle, impactCaseStudy };
}

describe("persons", () => {
	describe("GET /api/persons", () => {
		it("should return paginated list of persons", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const positions = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						description: item.affiliation.description,
						entity: {
							id: item.affiliation.entity.id,
							type: "institution",
							slug: item.affiliation.entity.slug,
							label: item.affiliation.organisationalUnit.name,
							// An institution with no country relation has no page on the website.
							href: null,
						},
					}),
				]);

				const response = await client.persons.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					expect.arrayContaining([expect.objectContaining({ name, positions })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/persons/:id", () => {
		it("should return single person", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const id = item.version.id;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const positions = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						description: item.affiliation.description,
						entity: {
							id: item.affiliation.entity.id,
							type: "institution",
							slug: item.affiliation.entity.slug,
							label: item.affiliation.organisationalUnit.name,
							// An institution with no country relation has no page on the website.
							href: null,
						},
					}),
				]);

				const response = await client.persons[":id"].$get({
					param: { id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as Person;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data).toMatchObject({ name, positions });
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data.image).toMatchObject({ url: expect.any(String) });
				expect(data.entity).toMatchObject({ slug: item.entity.slug });
				expect(data.biography).toHaveLength(1);
				expect(data.biography[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return articles the person contributed to, newest first", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(1);
				await seed(db, items);

				const item = items.at(0)!;
				const { spotlightArticle, impactCaseStudy } = await seedContributions(db, item.entity.id);

				const response = await client.persons[":id"].$get({
					param: { id: item.version.id },
				});

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as Person;

				// The draft spotlight article is not published, so it must not surface.
				expect(data.articles).toHaveLength(2);
				expect(data.articles.at(0)).toMatchObject({
					type: "spotlight_article",
					id: spotlightArticle.article.id,
					title: spotlightArticle.article.title,
					summary: spotlightArticle.article.summary,
					entity: {
						id: spotlightArticle.entity.id,
						type: "spotlight_articles",
						slug: spotlightArticle.entity.slug,
						label: spotlightArticle.article.title,
						href: `/spotlight/${spotlightArticle.entity.slug}`,
					},
					publishedAt: spotlightArticle.article.publicationDate.toISOString(),
					role: "author",
				});
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data.articles.at(0)?.image).toMatchObject({ url: expect.any(String) });
				expect(data.articles.at(1)).toMatchObject({
					type: "impact_case_study",
					id: impactCaseStudy.article.id,
					title: impactCaseStudy.article.title,
					entity: {
						id: impactCaseStudy.entity.id,
						type: "impact_case_studies",
						slug: impactCaseStudy.entity.slug,
						label: impactCaseStudy.article.title,
						href: `/about/impact-case-studies/${impactCaseStudy.entity.slug}`,
					},
					role: "editor",
				});
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons[":id"].$get({
					param: { id: "no-uuid" },
				});

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons[":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/persons/slugs", () => {
		it("should return paginated list of slugs", async () => {
			await withTransaction(async (db) => {
				const limit = 10;
				const offset = 0;

				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;

				const response = await client.persons.slugs.$get({
					query: {
						limit: String(limit),
						offset: String(offset),
					},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				expect(data.total).toBeGreaterThanOrEqual(items.length);
				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ entity: { slug } })]),
				);
				expect(data.limit).toBe(limit);
				expect(data.offset).toBe(offset);
			});
		});
	});

	describe("GET /api/persons/slugs/:slug", () => {
		it("should return single person", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(3);
				await seed(db, items);

				const item = items.at(1)!;
				const slug = item.entity.slug;
				const name = item.person.name;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const positions = expect.arrayContaining([
					expect.objectContaining({
						role: "is_affiliated_with",
						description: item.affiliation.description,
						entity: {
							id: item.affiliation.entity.id,
							type: "institution",
							slug: item.affiliation.entity.slug,
							label: item.affiliation.organisationalUnit.name,
							// An institution with no country relation has no page on the website.
							href: null,
						},
					}),
				]);

				const response = await client.persons.slugs[":slug"].$get({
					param: { slug },
					query: {},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("biography" in data);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expect(data).toMatchObject({ name, positions });
				expect(data.biography).toHaveLength(1);
				expect(data.biography[0]).toMatchObject({ type: "rich_text" });
			});
		});

		it("should return articles the person contributed to", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const items = createItems(1);
				await seed(db, items);

				const item = items.at(0)!;
				const { spotlightArticle, impactCaseStudy } = await seedContributions(db, item.entity.id);

				const response = await client.persons.slugs[":slug"].$get({
					param: { slug: item.entity.slug },
					query: {},
				});

				expect(response.status).toBe(200);

				const data = await response.json();

				assert("articles" in data);
				expect(data.articles).toEqual([
					expect.objectContaining({
						type: "spotlight_article",
						id: spotlightArticle.article.id,
						role: "author",
					}),
					expect.objectContaining({
						type: "impact_case_study",
						id: impactCaseStudy.article.id,
						role: "editor",
					}),
				]);
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.persons.slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
					query: {},
				});

				expect(response.status).toBe(404);
			});
		});
	});
});
