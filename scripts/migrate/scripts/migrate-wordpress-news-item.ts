import { assert, createUrl, createUrlSearchParams, keyBy, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { createStorageService } from "@acdh-knowledge-base/storage";
import { and, eq } from "drizzle-orm";
import type {
	WP_REST_API_Attachment,
	WP_REST_API_Categories,
	WP_REST_API_Post,
	WP_REST_API_Posts,
} from "wp-types";

import { apiBaseUrl, placeholderImageUrl } from "../config/data-migration.config";
import { env } from "../config/env.config";
import type { WordPressData } from "../src/lib/get-wordpress-data";
import {
	createWordPressContentMigrator,
	normalizeWordPressSlug,
	readAssetsCacheData,
	toPlaintext,
	toSummary,
	writeAssetsCacheData,
} from "../src/lib/migrate-wordpress-content";

/**
 * The bulk `migrate-wordpress.ts` import already ran, but news keeps being published on the
 * WordPress site. This script migrates individual, freshly-published news items by their WordPress
 * slug — fetching them live (the bulk cache is stale) and inserting them with the exact same
 * entity/version/content shape as the bulk import. It is idempotent: a slug that already exists as
 * a news entity is skipped.
 *
 * Usage: `pnpm run data:migrate:wordpress-news-item <slug> [<slug> ...]`
 */

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

const storage = createStorageService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

const { upload, uploadFeaturedImage, migrateHtmlContent } = createWordPressContentMigrator(
	db,
	storage,
);

async function fetchJson<T>(url: URL): Promise<T> {
	const response = await fetch(url);
	assert(response.ok, `Request to "${url.href}" failed with status ${String(response.status)}.`);
	return (await response.json()) as T;
}

async function getNewsCategoryId(): Promise<number> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: "/wp-json/wp/v2/categories",
		searchParams: createUrlSearchParams({ slug: "news" }),
	});
	const categories = await fetchJson<WP_REST_API_Categories>(url);
	const news = categories[0];
	assert(news, "Missing news category.");
	return news.id;
}

async function getPostBySlug(slug: string): Promise<WP_REST_API_Post | null> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: "/wp-json/wp/v2/posts",
		searchParams: createUrlSearchParams({ slug, _embed: "author" }),
	});
	const posts = await fetchJson<WP_REST_API_Posts>(url);
	return posts[0] ?? null;
}

async function getMediaById(id: number): Promise<WP_REST_API_Attachment | null> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: `/wp-json/wp/v2/media/${String(id)}`,
	});
	const response = await fetch(url);
	if (!response.ok) {
		return null;
	}
	return (await response.json()) as WP_REST_API_Attachment;
}

async function main() {
	const slugs = process.argv.slice(2).filter((slug) => slug.trim().length > 0);

	assert(
		slugs.length > 0,
		"Provide at least one WordPress news slug: pnpm run data:migrate:wordpress-news-item <slug> [<slug> ...]",
	);

	const newsCategoryId = await getNewsCategoryId();

	const status = await db.query.entityStatus.findMany();
	const statusByType = keyBy(status, (item) => item.type);

	const types = await db.query.entityTypes.findMany();
	const typesByType = keyBy(types, (item) => item.type);

	const contentBlockTypes = await db.query.contentBlockTypes.findMany();
	const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

	const assetsCache = await readAssetsCacheData();

	const placeholderImage = await upload("images", assetsCache, placeholderImageUrl, "Placeholder");
	assert(placeholderImage, "Missing placeholder image.");
	const placeholderImageId = placeholderImage.id;

	for (const slug of slugs) {
		log.info(`Migrating news item "${slug}"...`);

		const post = await getPostBySlug(slug);

		if (post == null) {
			log.warn(`No WordPress post found for slug "${slug}". Skipping.`);
			continue;
		}

		if (post.status !== "publish") {
			log.warn(`News item "${slug}" has not been published (status "${post.status}"). Skipping.`);
			continue;
		}

		if (post.categories == null || !post.categories.includes(newsCategoryId)) {
			log.warn(`Post "${slug}" is not in the news category. Skipping.`);
			continue;
		}

		const entitySlug = normalizeWordPressSlug(post.slug, toPlaintext(post.title.rendered));

		const existing = await db
			.select({ id: schema.entities.id })
			.from(schema.entities)
			.where(
				and(eq(schema.entities.typeId, typesByType.news.id), eq(schema.entities.slug, entitySlug)),
			)
			.limit(1);

		if (existing.length > 0) {
			log.warn(`A news entity with slug "${entitySlug}" already exists. Skipping.`);
			continue;
		}

		let media: WordPressData["media"] = {};
		let featuredMediaId: number | undefined =
			post.featured_media !== 0 ? post.featured_media : undefined;

		if (featuredMediaId != null) {
			const attachment = await getMediaById(featuredMediaId);
			if (attachment != null) {
				media = { [featuredMediaId]: attachment };
			} else {
				log.warn(`Missing featured image (news slug "${slug}").`);
				featuredMediaId = undefined;
			}
		}

		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: entitySlug,
					typeId: typesByType.news.id,
					createdAt: new Date(post.date_gmt),
					updatedAt: new Date(post.modified_gmt),
				})
				.returning({ id: schema.entities.id });

			assert(entity);

			const [version] = await tx
				.insert(schema.entityVersions)
				.values({
					entityId: entity.id,
					statusId: statusByType.published.id,
				})
				.returning({ id: schema.entityVersions.id });

			assert(version);

			const id = version.id;

			const imageId = await uploadFeaturedImage(
				"images",
				assetsCache,
				media,
				featuredMediaId,
				post.id,
			);

			await tx.insert(schema.news).values({
				id,
				title: toPlaintext(post.title.rendered),
				summary: toSummary(post.excerpt.rendered),
				imageId: imageId ?? placeholderImageId,
				createdAt: new Date(post.date_gmt),
				updatedAt: new Date(post.modified_gmt),
			});

			if (post.content.rendered.trim().length === 0) {
				return;
			}

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: typesByType.news.id,
					fieldName: "content",
				},
			});

			assert(fieldName);

			const [field] = await tx
				.insert(schema.fields)
				.values({
					entityVersionId: version.id,
					fieldNameId: fieldName.id,
				})
				.returning({ id: schema.fields.id });

			assert(field);

			await migrateHtmlContent(
				tx,
				post.content.rendered,
				assetsCache,
				field.id,
				contentBlockTypesByType,
			);
		});

		log.success(`Migrated news item "${slug}" (entity slug "${entitySlug}").`);
	}

	await writeAssetsCacheData(assetsCache);
}

main()
	.catch((error: unknown) => {
		log.error("Failed to migrate news item.", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
