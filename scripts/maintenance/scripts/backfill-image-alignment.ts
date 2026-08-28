import * as path from "node:path";

import { createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq } from "@dariah-eric/database/sql";
import slugify from "@sindresorhus/slugify";

import { env } from "../config/env.config";
import { type EntityStatusType, groupByEntityVersion } from "../lib/entity-versions";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Restores the left/right float that WordPress `wp-block-image`/`alignleft`/`alignright` carried by
 * setting the matching migrated `image` content block's `layout` to `float-start`/`float-end`. Dry
 * run by default; `--apply` writes the changes.
 *
 * The original WordPress migration (`@dariah-eric/migrate`) parsed content with the stock TipTap
 * `Image` extension, which only reads `src`/`alt`/`title` — the wrapping `<figure class="alignleft
 * …">` is not a recognised node, so it was silently unwrapped and the float lost. That information
 * only still exists in the live WordPress site, so this re-fetches it from there rather than trying
 * to recover it from already-migrated data.
 *
 * Unlike the semantic `media_text` block (a portrait bound to a bio, hand-authored), a WordPress
 * float is presentational — it just pulls an image aside with text wrapping. So this is a plain,
 * non-destructive column update on the `image` block: no block is merged, deleted, or re-ordered,
 * and the following `rich_text` is left untouched (the float makes it wrap on its own at render).
 *
 * Matching is conservative and structural, not fuzzy: a WordPress image is only paired with a local
 * block when an `image` content block's asset carries that exact WordPress image URL as its `label`
 * (set verbatim by the migration's `upload()` step). An image reused across more than one block in
 * the same article is skipped rather than guessed at, as is a block an editor has already given a
 * non-`default` layout.
 *
 * @example
 * 	pnpm run data:backfill:image-alignment
 * 	pnpm run data:backfill:image-alignment -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "image-alignment.tsv");

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

interface WordPressPost {
	slug: string;
	content: { rendered: string };
}

/**
 * Same pagination contract as the migration's `getAll` (`X-WP-TotalPages`), kept local to avoid a
 * cross-package dependency on `@dariah-eric/migrate` for one header-driven loop.
 */
async function fetchAllPosts(apiBaseUrl: string): Promise<Array<WordPressPost>> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: "/wp-json/wp/v2/posts",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	const results: Array<WordPressPost> = [];

	const response = await fetch(url);
	results.push(...((await response.json()) as Array<WordPressPost>));

	const pages = Number(response.headers.get("X-WP-TotalPages") ?? 1);

	for (let page = 2; page <= pages; page++) {
		url.searchParams.set("page", String(page));
		const pageResponse = await fetch(url);
		results.push(...((await pageResponse.json()) as Array<WordPressPost>));
	}

	return results;
}

/**
 * Mirrors `normalizeWordPressSlug` from `@dariah-eric/migrate` closely enough for matching
 * purposes: decode, then slugify. Skips that function's empty-slug fallback to a plaintext title —
 * WordPress posts always carry a real slug, so that branch is not reachable here.
 */
function normalizeWordPressSlug(rawSlug: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(rawSlug);
	} catch {
		decoded = rawSlug;
	}
	return slugify(decoded);
}

type ImageLayout = (typeof schema.imageLayoutEnum)[number];

interface WordPressFloatedImage {
	layout: Extract<ImageLayout, "float-start" | "float-end">;
	imageUrl: string;
}

/**
 * Finds `<div class="wp-block-image"><figure class="align(left|right) …"><img
 * src="…">…</figure></div>` — the Gutenberg "image" block with alignment set — in document order.
 * Regex-based, matching the migration's own approach to WordPress HTML (`extractAccordionItems`,
 * the iframe scan) rather than a full DOM parser.
 */
function extractFloatedImages(html: string): Array<WordPressFloatedImage> {
	const results: Array<WordPressFloatedImage> = [];
	const re =
		/<div[^>]+class="[^"]*\bwp-block-image\b[^"]*"[^>]*>\s*<figure[^>]+class="[^"]*\balign(left|right)\b[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/figure>\s*<\/div>/gi;

	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		results.push({
			layout: match[1] === "left" ? "float-start" : "float-end",
			imageUrl: match[2]!,
		});
	}

	return results;
}

interface ImageBlock {
	blockId: string;
	/** The exact source URL the migration uploaded this image from. */
	imageAssetLabel: string | null;
	layout: ImageLayout;
}

/** One lifecycle version's `image` content blocks. */
interface ImageVersion {
	documentId: string;
	fieldId: string;
	status: EntityStatusType;
	blocks: Array<ImageBlock>;
}

/** `news` entities' `image` content blocks, per version, keyed by entity slug. */
async function findNewsImageBlocks(): Promise<Map<string, Array<ImageVersion>>> {
	const rows = await db
		.select({
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			fieldId: schema.contentBlocks.fieldId,
			blockId: schema.contentBlocks.id,
			imageAssetLabel: schema.assets.label,
			layout: schema.imageContentBlocks.layout,
		})
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entities.typeId, schema.entityTypes.id))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.entityId, schema.entities.id))
		.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(schema.fields, eq(schema.fields.entityVersionId, schema.entityVersions.id))
		.innerJoin(
			schema.entityTypesFieldsNames,
			eq(schema.fields.fieldNameId, schema.entityTypesFieldsNames.id),
		)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.fieldId, schema.fields.id))
		.innerJoin(schema.imageContentBlocks, eq(schema.imageContentBlocks.id, schema.contentBlocks.id))
		.innerJoin(schema.assets, eq(schema.assets.id, schema.imageContentBlocks.imageId))
		.where(
			and(
				eq(schema.entityTypes.type, "news"),
				eq(schema.entityTypesFieldsNames.fieldName, "content"),
			),
		)
		.orderBy(schema.slugs.value, schema.entityStatus.type, schema.contentBlocks.position);

	return groupByEntityVersion(rows, {
		documentKey: (row) => row.slug,
		create: (row): ImageVersion => {
			return {
				documentId: row.documentId,
				fieldId: row.fieldId,
				status: row.status,
				blocks: [],
			};
		},
		add: (version, row) => {
			version.blocks.push({
				blockId: row.blockId,
				imageAssetLabel: row.imageAssetLabel,
				layout: row.layout,
			});
		},
	});
}

interface Candidate {
	entitySlug: string;
	entityDocumentId: string;
	entityVersionStatus: EntityStatusType;
	layout: WordPressFloatedImage["layout"];
	wpImageUrl: string;
	imageContentBlockId: string;
}

function findCandidates(
	posts: Array<WordPressPost>,
	imagesBySlug: Map<string, Array<ImageVersion>>,
): Array<Candidate> {
	const candidates: Array<Candidate> = [];

	for (const post of posts) {
		const floatedImages = extractFloatedImages(post.content.rendered);
		if (floatedImages.length === 0) {
			continue;
		}

		const slug = normalizeWordPressSlug(post.slug);
		const versions = imagesBySlug.get(slug);
		if (versions == null) {
			continue;
		}

		// Each version is matched on its own, so "exactly one block uses this image" is judged within
		// one version rather than across draft and published together — which would always be
		// ambiguous for a document that has both.
		for (const version of versions) {
			for (const floated of floatedImages) {
				const matches = version.blocks.filter(
					(block) => block.imageAssetLabel === floated.imageUrl,
				);
				// Ambiguous (same image reused) or unmatched — skip rather than guess.
				if (matches.length !== 1) {
					continue;
				}
				const [imageBlock] = matches;
				// An editor has already chosen a layout for this block; leave it be.
				if (imageBlock!.layout !== "default") {
					continue;
				}

				candidates.push({
					entitySlug: slug,
					entityDocumentId: version.documentId,
					entityVersionStatus: version.status,
					layout: floated.layout,
					wpImageUrl: floated.imageUrl,
					imageContentBlockId: imageBlock!.blockId,
				});
			}
		}
	}

	return candidates;
}

const reportColumns = [
	"entity_slug",
	"entity_document_id",
	"entity_version_status",
	"layout",
	"wp_image_url",
	"image_content_block_id",
] as const;

async function writeReport(candidates: Array<Candidate>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		reportColumns,
		candidates.map((candidate) => [
			candidate.entitySlug,
			candidate.entityDocumentId,
			candidate.entityVersionStatus,
			candidate.layout,
			candidate.wpImageUrl,
			candidate.imageContentBlockId,
		]),
	);
}

/**
 * Sets each matched image block's `layout`, guarded so a block an editor has since given a
 * non-`default` layout (or that no longer exists) is skipped rather than overwritten.
 */
async function applyCandidates(candidates: Array<Candidate>): Promise<number> {
	let applied = 0;

	for (const candidate of candidates) {
		const result = await db
			.update(schema.imageContentBlocks)
			.set({ layout: candidate.layout })
			.where(
				and(
					eq(schema.imageContentBlocks.id, candidate.imageContentBlockId),
					eq(schema.imageContentBlocks.layout, "default"),
				),
			);

		if (result.rowCount === 0) {
			log.warn(
				`Skipping ${candidate.entitySlug} (${candidate.entityVersionStatus}, ${candidate.wpImageUrl}): block missing or already has a non-default layout.`,
			);
			continue;
		}

		applied += 1;
	}

	return applied;
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress posts…");
	const posts = await fetchAllPosts(wordPressApiBaseUrl);

	log.info("Loading migrated news image content blocks…");
	const imagesBySlug = await findNewsImageBlocks();

	const candidates = findCandidates(posts, imagesBySlug);

	await writeReport(candidates);

	log.info(
		`${String(candidates.length)} image blocks to update (counting each version) across ${String(posts.length)} WordPress posts.`,
	);
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info(`Pass \`--apply\` to set their \`image\` block layout.`);
		return;
	}

	const applied = await applyCandidates(candidates);
	log.success(`Set the layout on ${String(applied)} image blocks.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
