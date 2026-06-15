import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { assert, isNonEmptyString, keyBy, log } from "@acdh-oeaw/lib";
import { type Database, type Transaction, createDatabaseService } from "@acdh-knowledge-base/database";
import * as schema from "@acdh-knowledge-base/database/schema";
import { createStorageService } from "@acdh-knowledge-base/storage";
import type { AssetPrefix } from "@acdh-knowledge-base/storage/config";
import slugify from "@sindresorhus/slugify";
import { and, eq } from "drizzle-orm";

import {
	apiBaseUrl,
	cacheFilePath,
	cacheFolderPath,
	placeholderImageUrl,
} from "../config/data-migration.config";
import { env } from "../config/env.config";
import { type WordPressData, getWordPressData } from "../src/lib/get-wordpress-data";
import {
	type AssetsCache,
	createWordPressContentMigrator,
	normalizeWordPressSlug,
	readAssetsCacheData,
	toPlaintext,
	toSummary,
	writeAssetsCacheData,
} from "../src/lib/migrate-wordpress-content";

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

/**
 * Relations and article contributors are now keyed by document id (`entities.id`). This import
 * builds entity _version_ ids, so resolve a version id to its document id before inserting into
 * those tables.
 */
async function documentIdOf(executor: Database | Transaction, versionId: string): Promise<string> {
	const [row] = await executor
		.select({ entityId: schema.entityVersions.entityId })
		.from(schema.entityVersions)
		.where(eq(schema.entityVersions.id, versionId))
		.limit(1);
	assert(row, `No entity version found for id "${versionId}".`);
	return row.entityId;
}

function extractAuthorsFromHtml(html: string): Array<string> {
	const lines = toPlaintext(html)
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.slice(0, 20);

	const affiliations = [
		"university",
		"college",
		"institute",
		"institut",
		"dariah",
		"clariah",
		"professor",
		"assistant",
		"associate",
		"scientific",
		"lecturer",
		"research",
		"department",
		"school",
		"faculty",
		"centre",
		"center",
		"library",
		"museum",
		"archive",
		"editor",
		"editors",
		"course editors",
		"one of the course editors",
		"followed by",
	];

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	const isLikelyName = (value: string): boolean => {
		const parts = value.trim().split(/\s+/);

		if (parts.length < 2 || parts.length > 5) {
			return false;
		}

		return parts.every((part, index) => {
			if (/^[A-Z]\.$/u.test(part)) {
				return true;
			}

			if (index > 0 && /^(?:de|del|van|von|da|di|du|la|le|der|den)$/i.test(part)) {
				return true;
			}

			return /^[A-Z][\p{L}'’.-]*$/u.test(part);
		});
	};

	const cleanCandidate = (value: string): Array<string> => {
		let candidate = value.trim().replaceAll(/\s+/g, " ");

		if (candidate.length === 0) {
			return [];
		}

		candidate = candidate.replace(/\s*\([^)]*\)\s*$/, "");
		candidate = candidate.replace(/\s*\[[^\]]*\]\s*$/, "");
		candidate = candidate.split(",")[0] ?? candidate;
		candidate = candidate.split(" - ")[0] ?? candidate;
		candidate = candidate.split(" – ")[0] ?? candidate;
		candidate = candidate.split(" — ")[0] ?? candidate;
		candidate = candidate.trim();

		if (candidate.length === 0) {
			return [];
		}

		const pieces = candidate.split(/[,;/&]|\sand\s/i);

		return pieces
			.map((piece) => piece.trim())
			.filter((piece) => piece.length > 0)
			.filter((piece) => {
				const lower = piece.toLowerCase();

				if (affiliations.some((marker) => lower.includes(marker))) {
					return false;
				}

				return isLikelyName(piece);
			});
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]!;
		const bylineMatch = /^(?:written by|lead author|by)\s*:?\s*/i.exec(line);

		if (bylineMatch != null) {
			const authors = cleanCandidate(line.slice(bylineMatch[0].length));

			if (authors.length > 0) {
				return authors;
			}

			const continuation = lines.slice(index + 1, index + 4).join(" ");
			const continuationAuthors = cleanCandidate(continuation);

			if (continuationAuthors.length > 0) {
				return continuationAuthors;
			}
		}
	}

	return [];
}

const deniedPageLinks = new Set([
	"https://www.dariah.eu/about/documents-list/", // documents-policies
	"https://www.dariah.eu/", // landing page uses visual composer shortcodes
]);

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

interface ListPageImageReference {
	pageSlug: string;
	pageHref: string;
	imageUrl: string;
	mediaId: number | null;
	title: string;
	alt: string | null;
}

async function uploadListPageImage(
	prefix: AssetPrefix,
	assetsCache: AssetsCache,
	media: WordPressData["media"],
	image: ListPageImageReference,
) {
	const wpMedia = image.mediaId != null ? media[image.mediaId] : undefined;
	const url = new URL(wpMedia?.source_url ?? image.imageUrl, apiBaseUrl);
	const label =
		wpMedia != null ? toPlaintext(wpMedia.title.rendered).trim() : image.title || image.pageSlug;
	const caption = wpMedia != null ? toPlaintext(wpMedia.caption.rendered).trim() : image.title;
	const alt = wpMedia?.alt_text ?? image.alt ?? undefined;
	const asset = await upload(prefix, assetsCache, url, label, caption, alt);

	assert(asset, `Missing list page image asset (${image.pageSlug}).`);

	return asset.id;
}

function decodeHtmlAttribute(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#039;", "'")
		.replaceAll("&#8217;", "'");
}

function getHtmlAttribute(html: string, attribute: string): string | null {
	const match = new RegExp(`\\s${attribute}="([^"]*)"`, "i").exec(html);
	return match != null ? decodeHtmlAttribute(match[1]!) : null;
}

function getSlugFromWordPressHref(href: string): string | null {
	try {
		const url = new URL(href, apiBaseUrl);
		const parts = url.pathname.split("/").filter((part) => part.length > 0);
		return parts.at(-1) ?? null;
	} catch {
		return null;
	}
}

function extractListPageImageReferences(
	html: string,
	expectedPathPrefix: string,
): Map<string, ListPageImageReference> {
	const images = new Map<string, ListPageImageReference>();
	const figureRe = /<figure\b[\s\S]*?<\/figure>/gi;
	let figureMatch: RegExpExecArray | null;

	while ((figureMatch = figureRe.exec(html)) !== null) {
		const figureHtml = figureMatch[0];
		const hrefMatches = Array.from(figureHtml.matchAll(/<a\b[^>]*\shref="([^"]*)"[^>]*>/gi));
		const href = hrefMatches
			.map((match) => decodeHtmlAttribute(match[1]!))
			.find((candidate) => {
				try {
					const url = new URL(candidate, apiBaseUrl);
					return url.pathname.startsWith(expectedPathPrefix);
				} catch {
					return false;
				}
			});

		if (href == null) {
			continue;
		}

		const imageMatch = /<img\b[^>]*>/i.exec(figureHtml);
		const imageHtml = imageMatch?.[0];
		if (imageHtml == null) {
			continue;
		}

		const imageUrl = getHtmlAttribute(imageHtml, "src") ?? getHtmlAttribute(imageHtml, "data-src");
		const pageSlug = getSlugFromWordPressHref(href);
		if (imageUrl == null || pageSlug == null || images.has(pageSlug)) {
			continue;
		}

		const mediaIdMatch = /\bwp-image-(\d+)\b/i.exec(imageHtml);
		const captionMatch = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(figureHtml);
		const title = captionMatch != null ? toPlaintext(captionMatch[1]!).trim() : pageSlug;
		const alt = getHtmlAttribute(imageHtml, "alt");

		images.set(pageSlug, {
			pageSlug,
			pageHref: href,
			imageUrl: String(new URL(imageUrl, apiBaseUrl)),
			mediaId: mediaIdMatch != null ? Number(mediaIdMatch[1]) : null,
			title,
			alt,
		});
	}

	return images;
}

async function getData(): Promise<WordPressData> {
	if (existsSync(cacheFilePath)) {
		const data = await fs.readFile(cacheFilePath, { encoding: "utf-8" });
		return JSON.parse(data) as WordPressData;
	}

	const data = await getWordPressData(apiBaseUrl);

	await fs.mkdir(cacheFolderPath, { recursive: true });
	await fs.writeFile(cacheFilePath, JSON.stringify(data, null, 2), { encoding: "utf-8" });

	return data;
}

interface ProjectMetadata {
	fullName: string | null;
	duration: { start: Date; end?: Date } | null;
	funding: number | null;
	topic: string | null;
	summary: string | null;
}

const projectMetadataConflictLogFilePath = path.join(
	cacheFolderPath,
	"wordpress-project-metadata-conflicts.log",
);

async function logProjectMetadataConflict(message: string): Promise<void> {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	await fs.appendFile(projectMetadataConflictLogFilePath, line, { encoding: "utf-8" });
}

function parseProjectDate(s: string): Date | null {
	const m = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(s.trim());
	if (!m) {
		return null;
	}
	return new Date(Date.UTC(Number(m[3]!), Number(m[2]!) - 1, Number(m[1]!)));
}

function parseEuContribution(raw: string): number | null {
	const cleaned = raw.trim().replaceAll(/\s/g, "").replace(",", ".");
	const n = Number.parseFloat(cleaned);
	return Number.isNaN(n) || n === 0 ? null : n;
}

function extractProjectMetadata(html: string): ProjectMetadata {
	// <!--more--> can appear inside <strong> tags (e.g. IPERION CH)
	const normalized = html.replaceAll("<!--more-->", "");

	const fullNameMatch = /<strong>\s*Full project name[^<]*<\/strong>\s*(?::\s*)?([^<\n]+)/i.exec(
		normalized,
	);
	const durationMatch =
		/<strong>\s*Duration[^<]*<\/strong>\s*(?::\s*)?from\s+([\d/-]+)\s+to\s+([\d/-]+)/i.exec(
			normalized,
		);
	const euMatch = /<strong>EU Contribution<\/strong>\s*(?::\s*)?EUR\s*([\d\s,.']*\d)/i.exec(
		normalized,
	);
	const topicMatch = /<strong>Topic<\/strong>[^<]*<a[^>]+href="([^"]+)"/i.exec(normalized);
	const summaryMatch = /<strong>Summary<\/strong>\s*:\s*([\s\S]*?)(?=<\/p>)/i.exec(normalized);

	const startDate = durationMatch ? parseProjectDate(durationMatch[1]!) : null;
	const endDate = durationMatch ? parseProjectDate(durationMatch[2]!) : null;

	return {
		fullName: fullNameMatch ? fullNameMatch[1]!.trim() : null,
		duration: startDate ? { start: startDate, end: endDate ?? undefined } : null,
		funding: euMatch ? parseEuContribution(euMatch[1]!) : null,
		topic: topicMatch ? topicMatch[1]! : null,
		summary: summaryMatch ? summaryMatch[1]!.replaceAll(/<[^>]+>/g, "").trim() : null,
	};
}

function stripProjectMetaBlock(html: string): string {
	return html
		.replaceAll("<!--more-->", "")
		.replaceAll(
			/<p>\s*<strong>\s*(?:Full project name|Duration|EU Contribution|Topic|Summary|Website|Funding scheme)[^<]*<\/strong>[\s\S]*?<\/p>/gi,
			"",
		)
		.trim();
}

function getPageEntityType(
	pageLink: string,
): "impact_case_studies" | "pages" | "spotlight_articles" {
	if (pageLink.startsWith("https://www.dariah.eu/activities/impact-case-studies/")) {
		return "impact_case_studies";
	}

	if (pageLink.startsWith("https://www.dariah.eu/activities/spotlight/")) {
		return "spotlight_articles";
	}

	return "pages";
}

function isBlank(value: string | null | undefined): boolean {
	return value == null || value.trim().length === 0;
}

function normalizeInstitutionLookupValue(value: string): string {
	return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function isPlaceholderProjectDuration(duration: { start: Date; end?: Date } | null): boolean {
	if (duration == null) {
		return true;
	}

	const placeholderStart = Date.UTC(1900, 0, 1);

	return (
		duration.start.getTime() === placeholderStart &&
		(duration.end == null || duration.end.getTime() === placeholderStart)
	);
}

function hasDifferentProjectDuration(
	left: { start: Date; end?: Date },
	right: { start: Date; end?: Date },
): boolean {
	return (
		left.start.getTime() !== right.start.getTime() ||
		(left.end?.getTime() ?? null) !== (right.end?.getTime() ?? null)
	);
}

async function main() {
	log.info("Retrieving data from wordpress...");

	const data = await getData();

	const assetsCache = await readAssetsCacheData();
	await fs.writeFile(projectMetadataConflictLogFilePath, "", { encoding: "utf-8" });

	const categoriesBySlug = keyBy(Object.values(data.categories), (item) => item.slug);

	const status = await db.query.entityStatus.findMany();
	const statusByType = keyBy(status, (item) => item.type);

	const types = await db.query.entityTypes.findMany();
	const typesByType = keyBy(types, (item) => item.type);

	const wpInstitutionIdToOrgUnitId = new Map<number, string>();

	const spotlightArticleIdToAuthorNames = new Map<string, Array<string>>();
	const impactCaseStudyIdToAuthorNames = new Map<string, Array<string>>();

	const projectScopes = await db.query.projectScopes.findMany();
	const projectScopesByType = keyBy(projectScopes, (item) => item.scope);

	const projectRoles = await db.query.projectRoles.findMany();
	const projectRolesByType = keyBy(projectRoles, (item) => item.role);

	const contentBlockTypes = await db.query.contentBlockTypes.findMany();
	const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

	const entityTypes = await db.query.entityTypes.findMany();
	const entityTypesByType = keyBy(entityTypes, (item) => item.type);

	const organisationalUnitTypes = await db.query.organisationalUnitTypes.findMany();
	const organisationalUnitTypesByType = keyBy(organisationalUnitTypes, (item) => item.type);

	const socialMediaTypes = await db.query.socialMediaTypes.findMany();
	const socialMediaTypesByType = keyBy(socialMediaTypes, (item) => item.type);

	const organisationalUnitStatus = await db.query.organisationalUnitStatus.findMany();
	const organisationalUnitStatusByType = keyBy(organisationalUnitStatus, (item) => item.status);

	const umbrellaUnit = await db.query.organisationalUnits.findFirst({
		where: {
			entityVersion: {
				entity: {
					slug: "dariah-eu",
				},
			},
			type: {
				type: "eric",
			},
		},
	});

	const placeholderImage = await upload("images", assetsCache, placeholderImageUrl, "Placeholder");
	assert(placeholderImage, "Missing placeholder image.");
	const placeholderImageId = placeholderImage.id;

	const impactCaseStudiesListPage = Object.values(data.pages).find(
		(page) => page.slug === "impact-case-studies",
	);
	const spotlightListPage = Object.values(data.pages).find((page) => page.slug === "spotlight");
	const impactCaseStudyListPageImages =
		impactCaseStudiesListPage != null
			? extractListPageImageReferences(
					impactCaseStudiesListPage.content.rendered,
					"/activities/impact-case-studies/",
				)
			: new Map<string, ListPageImageReference>();
	const spotlightListPageImages =
		spotlightListPage != null
			? extractListPageImageReferences(spotlightListPage.content.rendered, "/activities/spotlight/")
			: new Map<string, ListPageImageReference>();
	log.info(
		`Found ${String(impactCaseStudyListPageImages.size)} impact case study list images and ${String(
			spotlightListPageImages.size,
		)} spotlight list images.`,
	);

	const institutionOrgUnitIdsByName = new Map<string, string>();
	const existingInstitutionOrgUnits = await db.query.organisationalUnits.findMany({
		where: { type: { type: "institution" } },
		columns: { id: true, name: true },
	});

	for (const institution of existingInstitutionOrgUnits) {
		const name = normalizeInstitutionLookupValue(institution.name);
		if (!institutionOrgUnitIdsByName.has(name)) {
			institutionOrgUnitIdsByName.set(name, institution.id);
		}
	}

	const countryOrgUnitIdsByName = new Map<string, string>();
	const existingCountryOrgUnits = await db.query.organisationalUnits.findMany({
		where: { type: { type: "country" } },
		columns: { id: true, name: true },
	});

	for (const country of existingCountryOrgUnits) {
		const name = normalizeInstitutionLookupValue(country.name);
		if (!countryOrgUnitIdsByName.has(name)) {
			countryOrgUnitIdsByName.set(name, country.id);
		}
	}

	if (umbrellaUnit != null) {
		const umbrellaName = normalizeInstitutionLookupValue(umbrellaUnit.name);
		if (!institutionOrgUnitIdsByName.has(umbrellaName)) {
			institutionOrgUnitIdsByName.set(umbrellaName, umbrellaUnit.id);
		}
	}

	const wpCoordinatorInstitutionIds = new Set<number>();
	const wpRepresentativeInstitutionIds = new Set<number>();

	for (const country of Object.values(data.countries)) {
		for (const person of country.coordinators_data) {
			if (person.institution !== 0) {
				wpCoordinatorInstitutionIds.add(person.institution);
			}
		}

		for (const person of country.repPersons_data) {
			if (person.institution !== 0) {
				wpRepresentativeInstitutionIds.add(person.institution);
			}
		}
	}

	async function ensureOrganisationalUnitRelation(
		tx: Transaction,
		args: { unitId: string; relatedUnitId: string; statusId: string },
	): Promise<void> {
		// unit↔unit relations are document-level; resolve the version-id args to their document ids.
		const unitDocumentId = await documentIdOf(tx, args.unitId);
		const relatedUnitDocumentId = await documentIdOf(tx, args.relatedUnitId);

		const [existingRelation] = await tx
			.select({ id: schema.organisationalUnitsRelations.id })
			.from(schema.organisationalUnitsRelations)
			.where(
				and(
					eq(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentId),
					eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, relatedUnitDocumentId),
					eq(schema.organisationalUnitsRelations.status, args.statusId),
				),
			)
			.limit(1);

		if (existingRelation != null) {
			return;
		}

		await tx.insert(schema.organisationalUnitsRelations).values({
			unitDocumentId,
			relatedUnitDocumentId,
			duration: { start: new Date(Date.UTC(1900, 0, 1)) },
			status: args.statusId,
		});
	}

	async function ensureInstitutionOrgUnit(
		tx: Transaction,
		wpInstitutionId: number,
	): Promise<string | null> {
		const existingId = wpInstitutionIdToOrgUnitId.get(wpInstitutionId);
		if (existingId != null) {
			return existingId;
		}

		const institution = data.institutions[wpInstitutionId];
		if (institution == null) {
			log.warn(`Missing wordpress institution ${String(wpInstitutionId)} referenced by project.`);
			return null;
		}

		const name = toPlaintext(institution.title.rendered).trim();
		const normalizedName = normalizeInstitutionLookupValue(name);
		const existingInstitutionId = institutionOrgUnitIdsByName.get(normalizedName);

		if (existingInstitutionId != null) {
			wpInstitutionIdToOrgUnitId.set(wpInstitutionId, existingInstitutionId);
			return existingInstitutionId;
		}

		let slug = slugify(institution.slug || name);
		const slugExists = await tx.query.entities.findFirst({
			where: {
				typeId: typesByType.organisational_units.id,
				slug,
			},
			columns: {
				id: true,
			},
		});

		if (slugExists != null) {
			slug = `${slug}-duplicate-${randomUUID()}`;
		}

		const [entity] = await tx
			.insert(schema.entities)
			.values({
				slug,
				typeId: typesByType.organisational_units.id,
				createdAt: new Date(institution.date_gmt),
				updatedAt: new Date(institution.modified_gmt),
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

		const imageId = await uploadFeaturedImage(
			"logos",
			assetsCache,
			data.media,
			institution.featured_media,
			institution.id,
		);

		const metadata = isNonEmptyString(institution.website) ? { url: institution.website } : {};

		const [orgUnit] = await tx
			.insert(schema.organisationalUnits)
			.values({
				id: version.id,
				name,
				summary: toSummary(institution.content.rendered),
				typeId: organisationalUnitTypesByType.institution.id,
				metadata,
				imageId: imageId ?? placeholderImageId,
				createdAt: new Date(institution.date_gmt),
				updatedAt: new Date(institution.modified_gmt),
			})
			.returning({ id: schema.organisationalUnits.id });

		assert(orgUnit);

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const countryName = institution.country_data?.title;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (countryName != null) {
			const countryUnitId = countryOrgUnitIdsByName.get(
				normalizeInstitutionLookupValue(countryName),
			);
			if (countryUnitId != null) {
				await ensureOrganisationalUnitRelation(tx, {
					unitId: orgUnit.id,
					relatedUnitId: countryUnitId,
					statusId: organisationalUnitStatusByType.is_located_in.id,
				});
			}
		}

		institutionOrgUnitIdsByName.set(normalizedName, orgUnit.id);
		wpInstitutionIdToOrgUnitId.set(wpInstitutionId, orgUnit.id);

		return orgUnit.id;
	}

	/**
	 * ============================================================================================
	 * Pages.
	 * ============================================================================================
	 */

	log.info("Migrating pages...");

	for (const page of Object.values(data.pages)) {
		if (deniedPageLinks.has(page.link)) {
			continue;
		}

		assert(page.status === "publish", "Page has not been published.");

		await db.transaction(async (tx) => {
			const pageEntityType = getPageEntityType(page.link);
			const entityTypeId = typesByType[pageEntityType].id;

			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: normalizeWordPressSlug(page.slug, toPlaintext(page.title.rendered)),
					typeId: entityTypeId,
					createdAt: new Date(page.date_gmt),
					updatedAt: new Date(page.modified_gmt),
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

			let imageId: string | null = null;
			const listPageImage =
				pageEntityType === "impact_case_studies"
					? impactCaseStudyListPageImages.get(page.slug)
					: pageEntityType === "spotlight_articles"
						? spotlightListPageImages.get(page.slug)
						: undefined;

			if (listPageImage != null) {
				try {
					imageId = await uploadListPageImage("images", assetsCache, data.media, listPageImage);
				} catch {
					log.warn(`Failed to migrate list page image (page id ${String(page.id)}).`);
				}
			}

			imageId ??= await uploadFeaturedImage(
				"images",
				assetsCache,
				data.media,
				page.featured_media,
				page.id,
			);

			if (imageId == null) {
				log.warn(`Missing image (page id ${String(page.id)}).`);
			}

			if (pageEntityType === "impact_case_studies") {
				await tx.insert(schema.impactCaseStudies).values({
					id,
					title: toPlaintext(page.title.rendered),
					summary: toSummary(page.excerpt.rendered),
					imageId: imageId ?? placeholderImage.id,
					createdAt: new Date(page.date_gmt),
					updatedAt: new Date(page.modified_gmt),
				});
				const authorNames = extractAuthorsFromHtml(page.content.rendered);
				if (authorNames.length > 0) {
					impactCaseStudyIdToAuthorNames.set(id, authorNames);
				}
			} else if (pageEntityType === "spotlight_articles") {
				await tx.insert(schema.spotlightArticles).values({
					id,
					title: toPlaintext(page.title.rendered),
					summary: toSummary(page.excerpt.rendered),
					imageId: imageId ?? placeholderImage.id,
					createdAt: new Date(page.date_gmt),
					updatedAt: new Date(page.modified_gmt),
				});
				const authorNames = extractAuthorsFromHtml(page.content.rendered);
				if (authorNames.length > 0) {
					spotlightArticleIdToAuthorNames.set(id, authorNames);
				}
			} else {
				await tx.insert(schema.pages).values({
					id,
					title: toPlaintext(page.title.rendered),
					summary: toSummary(page.excerpt.rendered),
					imageId,
					createdAt: new Date(page.date_gmt),
					updatedAt: new Date(page.modified_gmt),
				});
			}

			if (page.content.rendered.trim().length === 0) {
				return;
			}

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId,
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
				page.content.rendered,
				assetsCache,
				field.id,
				contentBlockTypesByType,
			);
		});
	}

	/**
	 * ============================================================================================
	 * Documents and policies.
	 * ============================================================================================
	 */

	const documents = [
		{
			group: "DARIAH ERIC Statutes",
			items: [
				{
					title: "DARIAH ERIC Statutes February 2026",
					href: "https://www.dariah.eu/wp-content/uploads/2026/02/DARIAH-ERIC-Statutes-Version-February-2026.pdf",
					image: null,
					description: null,
					doi: null,
				},
				{
					title: "Internal Rules of Procedure and Policies December 2024",
					href: "https://www.dariah.eu/wp-content/uploads/2024/12/IRP-Version-December-2024.pdf",
					image: null,
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH Strategic Plan and DARIAH Strategic Action Plans",
			items: [
				{
					title: "DARIAH Strategic Plan 2019-2026",
					href: "https://www.dariah.eu/wp-content/uploads/2019/08/Strategic-Plan_2019-2026.pdf",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/09/Strategic-Plan-1-e1568200777643.png",
					description: null,
					doi: null,
				},
				{
					title: "DARIAH Strategic Action Plan II 2019-2022",
					href: "https://www.dariah.eu/wp-content/uploads/2020/05/DARIAH-Strategic-Action-Plan-II-2019-2022.pdf",
					image: null,
					description: null,
					doi: null,
				},
				{
					title: "DARIAH Strategic Action Plan III 2022-2025",
					href: "https://www.dariah.eu/wp-content/uploads/2022/07/DARIAH-Strategic-Action-Plan-III-2022-2025-final.pdf",
					image: null,
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH goes Green: Internal Environmental Guidelines",
			items: [
				{
					title: "DARIAH goes Green: Internal Environmental Guidelines",
					href: "https://www.dariah.eu/wp-content/uploads/2025/09/DARIAH-Goes-Green_-Internal-Environmental-Guidelines_01.pdf",
					image: null,
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH Gender Equality Plan",
			items: [
				{
					title: "DARIAH Gender Equality Plan 2022",
					href: "https://www.dariah.eu/wp-content/uploads/2022/06/Gender-Equality-Plan_final.pdf",
					image: null,
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH Annual Event Code of Conduct",
			items: [
				{
					title: "DARIAH Annual Event Code of Conduct 2025",
					href: "https://www.dariah.eu/wp-content/uploads/2025/04/DARIAH-Annual-Event-Code-of-Conduct.pdf",
					image: null,
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "Selected DARIAH ERIC reports",
			items: [
				{
					title: "Annual Report 2024",
					href: "https://www.dariah.eu/wp-content/uploads/2026/03/DARIAH-Annual-Report-2024.pdf",
					image: "https://www.dariah.eu/wp-content/uploads/2026/03/AR2024_Cover_1.png",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2025). DARIAH-EU Annual Report 2024. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.18846153",
				},
				{
					title: "Annual Report 2023",
					href: "https://www.dariah.eu/wp-content/uploads/2024/10/TCD-DARIAH-Annual-Report-2023.pdf",
					image: "https://www.dariah.eu/wp-content/uploads/2024/10/Annual-Report-2023_cover.png",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2024). DARIAH-EU Annual Report 2023. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.14007767",
				},
				{
					title: "Annual Report 2022",
					href: "https://www.dariah.eu/wp-content/uploads/2023/12/DARIAH-Annual-Report-2022.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2023). DARIAH-EU Annual Report 2022. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740997",
					image:
						"https://www.dariah.eu/wp-content/uploads/2023/12/DARIAH-AR-2022-e1702306350513.png",
				},
				{
					title: "Annual Report 2021",
					href: "https://www.dariah.eu/wp-content/uploads/2022/08/DARIAH-AR-2021-FINAL_2.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2022). DARIAH-EU Annual Report 2021. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740981",
					image: "https://www.dariah.eu/wp-content/uploads/2022/07/Annual-Report-2021_cover.jpg",
				},
				{
					title: "Annual Report 2020",
					href: "https://www.dariah.eu/wp-content/uploads/2021/06/DARIAH-EU-AnnualReport-2020.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2021). DARIAH-EU Annual Report 2020. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740975",
					image: "https://www.dariah.eu/wp-content/uploads/2021/06/AR2020_cover.png",
				},
				{
					title: "Annual Report 2019",
					href: "https://www.dariah.eu/wp-content/uploads/2020/07/DARIAH-annual-report-2019_v2.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2020). DARIAH-EU Annual Report 2019. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740965",
					image: "https://www.dariah.eu/wp-content/uploads/2020/05/Annual-Report-2019_cover.png",
				},
				{
					title: "Annual Report 2018",
					href: "https://www.dariah.eu/wp-content/uploads/2019/07/DARIAH_Annual_Report_2018.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2019). DARIAH-EU Annual Report 2018. Zenodo",
					doi: "https://doi.org/10.5281/zenodo.13740958",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/07/DARIAH_Annual_Report_2018-1_thumbail-1.jpg",
				},
				{
					title: "Annual Report 2017",
					href: "https://www.dariah.eu/wp-content/uploads/2018/12/DARIAH-Annual-Report-2017.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2018). DARIAH-EU Annual Report 2017. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740942",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/07/DARIAH-Annual-Report-2017_thumbnail.jpg",
				},
				{
					title: "Annual Report 2016",
					href: "https://www.dariah.eu/wp-content/uploads/2018/02/Dariah_Annual_Report_2016.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2017). DARIAH-EU Annual Report 2016. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740933",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/07/Dariah_Annual_Report_2016_thumbnail.jpg",
				},
				{
					title: "Annual Report 2015",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/2015_DARIAH_annual_report1.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2016). DARIAH-EU Annual Report 2015. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740902",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/07/2015_DARIAH_annual_report1_thumbnail.jpg",
				},
				{
					title: "Annual Report 2013",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/DARIAH-EU_Annual_report_2013.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2014). DARIAH-EU Annual Report 2013. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13740884",
					image: null,
				},
				{
					title: "Annual Report 2012",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/DARIAH-EU_Annual_report_2012.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2013). DARIAH-EU Annual Report 2012. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13736791",
					image: null,
				},
				{
					title: "Annual Report 2011",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/DARIAH-EU_Annual_report_2011.pdf",
					description:
						"Cite as: Digital Research Infrastructure for the Arts and Humanities. (2012). DARIAH-EU Annual Report 2011. Zenodo.",
					doi: "https://doi.org/10.5281/zenodo.13736811",
					image: null,
				},
			],
		},
		{
			group: "DARIAH Working Groups Policy Statement",
			items: [
				{
					title: "Working Groups Policy Statement",
					href: "https://www.dariah.eu/wp-content/uploads/2019/09/DARIAH-Working-Groups-Policy-Statement_v5.pdf",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/09/WG-Policy-Doc-e1568885895474.jpg",
					description: null,
					doi: null,
				},
				{
					title: "Introduction to the DARIAH Working Groups",
					href: "https://www.dariah.eu/wp-content/uploads/2019/09/DARIAH-Working-Groups-2.pdf",
					image:
						"https://www.dariah.eu/wp-content/uploads/2019/09/DARIAH-Working-Groups_intro-e1568887589582.png",
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "Cooperating Partners documents",
			items: [
				{
					title: "Template application form for European Cooperating Partner",
					href: "https://www.dariah.eu/wp-content/uploads/2021/01/EU-CP-Template-application-letter-DARIAH.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "Template application form for non-European Cooperating Partner",
					href: "https://www.dariah.eu/wp-content/uploads/2021/01/NON-EU-CP-Template-application-letter-DARIAH.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "Template European Cooperating Partner agreement",
					href: "https://www.dariah.eu/wp-content/uploads/2020/12/EU-CP-Binding-Agreement_MASTER-COPY.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "Template non-European Cooperating Partner agreement",
					href: "https://www.dariah.eu/wp-content/uploads/2020/12/NON-EU-CP-Binding-Agreement_MASTER-COPY.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "Benefits and requirements for becoming a DARIAH Cooperating Partner",
					href: "https://www.dariah.eu/wp-content/uploads/2020/12/DARIAH-CP-Factsheet.pdf",
					image: "https://www.dariah.eu/wp-content/uploads/2020/12/DARIAH-Infographics_2-.png",
					description: null,
					doi: null,
				},
			],
		},
		{
			group: "European Commission documents",
			items: [
				{
					title: "Riding the wave. How Europe can gain from the rising tide of scientific data",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/hlg-sdi-report.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title:
						"European Research Infrastructures with Global Impact (Description of DARIAH, p.9)",
					href: "https://www.dariah.eu/wp-content/uploads/2017/02/ESFRI_Brochure_210912_lowres.pdf",
					description: null,
					image: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH Logos",
			items: [
				{
					title: "DARIAH-EU Logos",
					href: "https://www.dariah.eu/wp-content/uploads/2018/02/dariah-eu_logos.zip",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "DARIAH Open Science Logos",
					href: "https://www.dariah.eu/wp-content/uploads/2018/02/DARIAH_OpenScience_logos.zip",
					description: null,
					image: null,
					doi: null,
				},
			],
		},
		{
			group: "DARIAH Style Guide",
			items: [
				{
					title: "DARIAH-EU Style guide",
					href: "https://www.dariah.eu/wp-content/uploads/2018/02/styleguide_dariaheu.pdf",
					description: null,
					image: null,
					doi: null,
				},
			],
		},
		{
			group: "Reimbursement of travel costs",
			items: [
				{
					title: "Guidelines for the reimbursement of travel costs",
					href: "https://www.dariah.eu/wp-content/uploads/2023/06/Guidelines-travel-claim_DARIAH_20230401-final.pdf",
					description: null,
					image: null,
					doi: null,
				},
				{
					title: "Travel claim form",
					href: "https://www.dariah.eu/wp-content/uploads/2023/06/DARIAH-travel-claim-form-2023.xlsx",
					description: null,
					image: null,
					doi: null,
				},
			],
		},
	];

	for (const { group, items } of documents) {
		const existing = await db.query.documentPolicyGroups.findMany({
			columns: { id: true },
		});

		const [documentPolicyGroup] = await db
			.insert(schema.documentPolicyGroups)
			.values({
				label: group,
				position: existing.length,
			})
			.returning({ id: schema.documentPolicyGroups.id });

		for (const item of items) {
			await db.transaction(async (tx) => {
				const [entity] = await tx
					.insert(schema.entities)
					.values({
						slug: slugify(item.title),
						typeId: typesByType.documents_policies.id,
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

				const response = await fetch(item.href);
				const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
				const input = await response.arrayBuffer();
				const { key } = (
					await storage.upload({
						prefix: "documents",
						input: Buffer.from(input),
						metadata: { "content-type": mimeType },
					})
				).unwrap();

				const [asset] = await tx
					.insert(schema.assets)
					.values({
						label: item.title,
						mimeType,
						key,
					})
					.returning({ id: schema.assets.id });

				assert(asset);

				await tx.insert(schema.documentsPolicies).values({
					groupId: documentPolicyGroup?.id,
					title: item.title,
					summary: item.description ?? "",
					url: item.doi ?? "",
					documentId: asset.id,
					id,
				});
			});
		}
	}

	/**
	 * ============================================================================================
	 * Initiatives.
	 * ============================================================================================
	 */

	log.info("Migrating initiatives...");

	for (const page of Object.values(data.initiatives)) {
		assert(page.status === "publish", "Initiative has not been published.");

		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: normalizeWordPressSlug(page.slug, toPlaintext(page.title.rendered)),
					typeId: typesByType.pages.id,
					createdAt: new Date(page.date_gmt),
					updatedAt: new Date(page.modified_gmt),
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
				data.media,
				page.featured_media,
				page.id,
			);

			if (imageId == null) {
				log.warn(`Missing image (initiative id ${String(page.id)}).`);
			}

			await tx.insert(schema.pages).values({
				id,
				title: toPlaintext(page.title.rendered),
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				summary: toSummary(page.excerpt?.rendered ?? ""),
				imageId,
				createdAt: new Date(page.date_gmt),
				updatedAt: new Date(page.modified_gmt),
			});

			if (page.content.rendered.trim().length === 0) {
				return;
			}

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: entityTypesByType.pages.id,
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
				page.content.rendered,
				assetsCache,
				field.id,
				contentBlockTypesByType,
			);
		});
	}

	/**
	 * ============================================================================================
	 * News.
	 * ============================================================================================
	 */

	log.info("Migrating news...");

	const news = categoriesBySlug.news?.id;
	assert(news, "Missing news category.");

	for (const post of Object.values(data.posts)) {
		if (post.categories == null) {
			continue;
		}
		if (!post.categories.includes(news)) {
			continue;
		}

		assert(post.status === "publish", "News item has not been published.");

		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: normalizeWordPressSlug(post.slug, toPlaintext(post.title.rendered)),
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
				data.media,
				post.featured_media,
				post.id,
			);

			if (imageId == null) {
				log.warn(`Missing image (news id ${String(post.id)}).`);
			}

			await tx.insert(schema.news).values({
				id,
				title: toPlaintext(post.title.rendered),
				summary: toSummary(post.excerpt.rendered),
				imageId: imageId ?? placeholderImage.id,
				createdAt: new Date(post.date_gmt),
				updatedAt: new Date(post.modified_gmt),
			});

			if (post.content.rendered.trim().length === 0) {
				return;
			}

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: entityTypesByType.news.id,
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
	}

	/**
	 * ============================================================================================
	 * Events.
	 * ============================================================================================
	 */

	log.info("Migrating events...");

	for (const event of Object.values(data.events)) {
		assert(event.status === "publish", "Event has not been published.");
		assert(event.utc_start_date, "Event has no start date");

		await db.transaction(async (tx) => {
			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug: normalizeWordPressSlug(event.slug, toPlaintext(event.title)),
					typeId: typesByType.events.id,
					createdAt: new Date(event.date_utc),
					updatedAt: new Date(event.modified_utc),
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

			const imageId =
				event.image !== false
					? await uploadFeaturedImage("images", assetsCache, data.media, event.image.id, event.id)
					: null;

			if (imageId == null) {
				log.warn(`Missing image (event id ${String(event.id)}).`);
			}

			await tx.insert(schema.events).values({
				id,
				title: toPlaintext(event.title),
				summary: toSummary(event.description),
				imageId: imageId ?? placeholderImage.id,
				website: event.website,
				location:
					Array.isArray(event.venue) && event.venue.length === 0
						? ""
						: [event.venue.venue, event.venue.country].filter(isNonEmptyString).join(", "),
				duration: {
					start: new Date(event.utc_start_date),
					end: isNonEmptyString(event.utc_end_date) ? new Date(event.utc_end_date) : undefined,
				},
				isFullDay: event.all_day,
				createdAt: new Date(event.date_utc),
				updatedAt: new Date(event.modified_utc),
			});

			if (event.description.trim().length === 0) {
				return;
			}

			const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
				where: {
					entityTypeId: entityTypesByType.events.id,
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
				event.description,
				assetsCache,
				field.id,
				contentBlockTypesByType,
			);
		});
	}

	/**
	 * ============================================================================================
	 * Projects.
	 * ============================================================================================
	 */

	log.info("Migrating projects...");

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	function normalizeProjectLookupValue(value: string): string {
		return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
	}

	const projectIdsByAcronym = new Map<string, string>();
	const projectIdsByName = new Map<string, string>();
	const existingProjectsById = new Map<
		string,
		{
			id: string;
			acronym: string | null;
			name: string;
			duration: { start: Date; end?: Date };
			funding: number | null;
			summary: string;
			topic: string | null;
		}
	>();
	const existingProjects = await db.query.projects.findMany({
		columns: {
			id: true,
			acronym: true,
			name: true,
			duration: true,
			funding: true,
			summary: true,
			topic: true,
		},
	});

	for (const project of existingProjects) {
		existingProjectsById.set(project.id, project);

		if (isNonEmptyString(project.acronym)) {
			const acronym = normalizeProjectLookupValue(project.acronym);
			if (!projectIdsByAcronym.has(acronym)) {
				projectIdsByAcronym.set(acronym, project.id);
			}
		}

		const name = normalizeProjectLookupValue(project.name);
		if (!projectIdsByName.has(name)) {
			projectIdsByName.set(name, project.id);
		}
	}

	for (const project of Object.values(data.projects)) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		assert(project.status === "publish", "Project has not been published.");

		const meta = extractProjectMetadata(project.content.rendered);

		if (meta.duration == null) {
			log.warn(
				`Project ${String(project.id)} ("${project.title.rendered}"): could not extract duration from HTML.`,
			);
		}

		// Prefer HTML-extracted full name over WP fullname field (WP data has known
		// corruptions, e.g. HIRMEOS has PARTHENOS's fullname). Fall back to title.
		const name = meta.fullName ?? (project.fullname || project.title.rendered);
		const acronym = project.title.rendered;
		const summary = (meta.summary ?? toSummary(project.excerpt.rendered)) || project.title.rendered;

		const existingProjectId =
			projectIdsByAcronym.get(normalizeProjectLookupValue(acronym)) ??
			projectIdsByName.get(normalizeProjectLookupValue(name)) ??
			projectIdsByName.get(normalizeProjectLookupValue(acronym));

		await db.transaction(async (tx) => {
			let projectId = existingProjectId;

			if (projectId == null) {
				const [entity] = await tx
					.insert(schema.entities)
					.values({
						slug: normalizeWordPressSlug(project.slug, toPlaintext(project.title.rendered)),
						typeId: typesByType.projects.id,
						createdAt: new Date(project.date_gmt),
						updatedAt: new Date(project.modified_gmt),
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

				const imageId = await uploadFeaturedImage(
					"logos",
					assetsCache,
					data.media,
					project.featured_media,
					project.id,
				);

				const [createdProject] = await tx
					.insert(schema.projects)
					.values({
						id: version.id,
						name,
						acronym,
						duration: meta.duration ?? {
							start: new Date(Date.UTC(1900, 0, 1)),
							end: new Date(Date.UTC(1900, 0, 1)),
						},
						funding: meta.funding,
						summary,
						topic: meta.topic,
						imageId: imageId ?? placeholderImageId,
						scopeId: projectScopesByType.eu.id /** We agreed to default to eu. */,
						createdAt: new Date(project.date_gmt),
						updatedAt: new Date(project.modified_gmt),
					})
					.returning({ id: schema.projects.id });

				assert(createdProject);

				projectIdsByAcronym.set(normalizeProjectLookupValue(acronym), createdProject.id);
				projectIdsByName.set(normalizeProjectLookupValue(name), createdProject.id);
				existingProjectsById.set(createdProject.id, {
					id: createdProject.id,
					acronym,
					name,
					duration: meta.duration ?? {
						start: new Date(Date.UTC(1900, 0, 1)),
						end: new Date(Date.UTC(1900, 0, 1)),
					},
					funding: meta.funding,
					summary,
					topic: meta.topic,
				});

				if (umbrellaUnit) {
					await tx
						.insert(schema.projectsToOrganisationalUnits)
						.values({
							projectDocumentId: await documentIdOf(tx, createdProject.id),
							unitDocumentId: await documentIdOf(tx, umbrellaUnit.id),
							roleId: projectRolesByType.participant.id,
						})
						.onConflictDoNothing();
				}

				if (isNonEmptyString(project.website)) {
					const [sm] = await tx
						.insert(schema.socialMedia)
						.values({
							name: `${name} website`,
							typeId: socialMediaTypesByType.website.id,
							url: project.website,
						})
						.returning({ id: schema.socialMedia.id });

					assert(sm);

					await tx.insert(schema.projectsToSocialMedia).values({
						projectId: createdProject.id,
						socialMediaId: sm.id,
					});
				}

				const contentHtml = stripProjectMetaBlock(project.content.rendered);

				if (contentHtml.length > 0) {
					const fieldName = await tx.query.entityTypesFieldsNames.findFirst({
						where: {
							entityTypeId: entityTypesByType.projects.id,
							fieldName: "description",
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

					await migrateHtmlContent(tx, contentHtml, assetsCache, field.id, contentBlockTypesByType);
				}

				projectId = createdProject.id;
			}

			if (existingProjectId != null) {
				const existingProject = existingProjectsById.get(existingProjectId);
				assert(existingProject);

				const projectUpdate: {
					name?: string;
					duration?: { start: Date; end?: Date };
					funding?: number | null;
					summary?: string;
					topic?: string | null;
				} = {};

				if (meta.fullName != null) {
					if (
						isBlank(existingProject.name) ||
						normalizeProjectLookupValue(existingProject.name) ===
							normalizeProjectLookupValue(existingProject.acronym ?? acronym)
					) {
						projectUpdate.name = meta.fullName;
					} else if (
						normalizeProjectLookupValue(existingProject.name) !==
						normalizeProjectLookupValue(meta.fullName)
					) {
						await logProjectMetadataConflict(
							`Project ${String(project.id)} matched existing project ${existingProjectId}: conflicting full name (db="${existingProject.name}", wordpress="${meta.fullName}").`,
						);
					}
				}

				if (meta.duration != null) {
					if (isPlaceholderProjectDuration(existingProject.duration)) {
						projectUpdate.duration = meta.duration;
					} else if (hasDifferentProjectDuration(existingProject.duration, meta.duration)) {
						await logProjectMetadataConflict(
							`Project ${String(project.id)} matched existing project ${existingProjectId}: conflicting duration (db="${existingProject.duration.start.toISOString()}..${existingProject.duration.end?.toISOString() ?? ""}", wordpress="${meta.duration.start.toISOString()}..${meta.duration.end?.toISOString() ?? ""}").`,
						);
					}
				}

				if (meta.funding != null) {
					if (existingProject.funding == null) {
						projectUpdate.funding = meta.funding;
					} else if (existingProject.funding !== meta.funding) {
						await logProjectMetadataConflict(
							`Project ${String(project.id)} matched existing project ${existingProjectId}: conflicting funding (db="${String(existingProject.funding)}", wordpress="${String(meta.funding)}").`,
						);
					}
				}

				if (meta.topic != null) {
					if (isBlank(existingProject.topic)) {
						projectUpdate.topic = meta.topic;
					} else if (existingProject.topic !== meta.topic) {
						await logProjectMetadataConflict(
							`Project ${String(project.id)} matched existing project ${existingProjectId}: conflicting topic (db="${existingProject.topic ?? ""}", wordpress="${meta.topic}").`,
						);
					}
				}

				if (meta.summary != null) {
					if (
						isBlank(existingProject.summary) ||
						normalizeProjectLookupValue(existingProject.summary) ===
							normalizeProjectLookupValue(acronym)
					) {
						projectUpdate.summary = meta.summary;
					} else if (existingProject.summary !== meta.summary) {
						await logProjectMetadataConflict(
							`Project ${String(project.id)} matched existing project ${existingProjectId}: conflicting summary (db="${existingProject.summary}", wordpress="${meta.summary}").`,
						);
					}
				}

				if (Object.keys(projectUpdate).length > 0) {
					await tx
						.update(schema.projects)
						.set(projectUpdate)
						.where(eq(schema.projects.id, existingProjectId));
					existingProjectsById.set(existingProjectId, {
						...existingProject,
						...projectUpdate,
					});
				}
			}

			assert(projectId);

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			if (project.relations.coordinator != null) {
				const coordinatorOrgUnitId = await ensureInstitutionOrgUnit(
					tx,
					project.relations.coordinator.id,
				);
				if (coordinatorOrgUnitId != null) {
					await tx
						.insert(schema.projectsToOrganisationalUnits)
						.values({
							projectDocumentId: await documentIdOf(tx, projectId),
							unitDocumentId: await documentIdOf(tx, coordinatorOrgUnitId),
							roleId: projectRolesByType.coordinator.id,
						})
						.onConflictDoNothing();
				}
			}

			const participantWpIds = new Set(
				project.relations.institutions
					.map((i) => i.id)
					.filter((id) => id !== project.relations.coordinator?.id),
			);

			for (const wpInstId of participantWpIds) {
				const unitId = await ensureInstitutionOrgUnit(tx, wpInstId);
				if (unitId != null) {
					await tx
						.insert(schema.projectsToOrganisationalUnits)
						.values({
							projectDocumentId: await documentIdOf(tx, projectId),
							unitDocumentId: await documentIdOf(tx, unitId),
							roleId: projectRolesByType.participant.id,
						})
						.onConflictDoNothing();
				}
			}
		});
	}

	/**
	 * ============================================================================================
	 * Author relations for spotlight articles and impact case studies.
	 * ============================================================================================
	 */

	log.info("Creating author relations for spotlight articles and impact case studies...");

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	function normalizePersonName(name: string): string {
		return name.trim().replaceAll(/\s+/g, " ").toLowerCase();
	}

	// oxlint-disable-next-line unicorn/consistent-function-scoping
	function createSortName(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);

		if (parts.length <= 1) {
			return name;
		}

		const lastName = parts.at(-1)!;
		const firstNames = parts.slice(0, -1).join(" ");

		return `${lastName}, ${firstNames}`;
	}

	const personsByName = new Map<string, string>();
	const existingPersons = await db.query.persons.findMany({
		columns: {
			id: true,
			name: true,
		},
	});

	for (const person of existingPersons) {
		personsByName.set(normalizePersonName(person.name), person.id);
	}

	async function ensurePersonByName(authorName: string): Promise<string> {
		const normalizedAuthorName = normalizePersonName(authorName);

		const exact = personsByName.get(normalizedAuthorName);
		if (exact != null) {
			return exact;
		}

		for (const [name, dbId] of personsByName) {
			if (normalizedAuthorName.includes(name)) {
				return dbId;
			}
		}

		const createdAt = new Date();

		const personId = await db.transaction(async (tx) => {
			let slug = slugify(authorName);
			const slugExists = await tx.query.entities.findFirst({
				where: {
					typeId: typesByType.persons.id,
					slug,
				},
				columns: {
					id: true,
				},
			});

			if (slugExists != null) {
				slug = `${slug}-duplicate-${randomUUID()}`;
			}

			const [entity] = await tx
				.insert(schema.entities)
				.values({
					slug,
					typeId: typesByType.persons.id,
					createdAt,
					updatedAt: createdAt,
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

			await tx.insert(schema.persons).values({
				id: version.id,
				name: authorName,
				sortName: createSortName(authorName),
				imageId: placeholderImageId,
				createdAt,
				updatedAt: createdAt,
			});

			return version.id;
		});

		personsByName.set(normalizedAuthorName, personId);
		log.info(`Created person "${authorName}" for author relation import.`);

		return personId;
	}

	for (const [articleId, authorNames] of spotlightArticleIdToAuthorNames) {
		for (const authorName of authorNames) {
			const personDbId = await ensurePersonByName(authorName);
			await db.insert(schema.spotlightArticlesToPersons).values({
				spotlightArticleDocumentId: await documentIdOf(db, articleId),
				personDocumentId: await documentIdOf(db, personDbId),
				role: "author",
			});
		}
	}

	for (const [articleId, authorNames] of impactCaseStudyIdToAuthorNames) {
		for (const authorName of authorNames) {
			const personDbId = await ensurePersonByName(authorName);
			await db.insert(schema.impactCaseStudiesToPersons).values({
				impactCaseStudyDocumentId: await documentIdOf(db, articleId),
				personDocumentId: await documentIdOf(db, personDbId),
				role: "author",
			});
		}
	}

	log.info("Writing assets cache manifest...");

	await writeAssetsCacheData(assetsCache);

	//

	log.success("Successfully completed data migration.");
}

main()
	.catch((error: unknown) => {
		log.error("Failed to complete data migration.", error);
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
