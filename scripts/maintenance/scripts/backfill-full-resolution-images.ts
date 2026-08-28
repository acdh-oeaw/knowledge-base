import * as path from "node:path";

import { createUrl, createUrlSearchParams, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq, like } from "@dariah-eric/database/sql";
import { createStorageService } from "@dariah-eric/storage";
import { buffer } from "@dariah-eric/storage/lib";
import sharp from "sharp";

import { env } from "../config/env.config";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Replaces migrated image assets that hold a downscaled WordPress derivative with the full-size
 * original. Dry run by default; `--apply` overwrites the storage objects.
 *
 * WordPress renders an inline image at a theme size and writes that derivative into the post's HTML
 * (`<img src="…/atrium-summer-school-612x612.webp">`, with the larger variants only offered in
 * `srcset`). The migration's `migrateHtmlContent` uploaded whatever that `src` pointed at, so an
 * image the media library holds at 1536×1536 is stored here at 612×612 and looks soft wherever the
 * site renders it larger than WordPress did — the `featured` variant alone asks for 1600px.
 *
 * The original is looked up, not guessed at. Every WordPress media item lists its derivatives under
 * `media_details.sizes`, so the stored `assets.label` — set verbatim to the migration's source url
 * — is matched against those urls exactly, which yields both the media item's own `source_url` (the
 * full size) and the derivative's dimensions. Filenames are never taken apart: `paris-1200x565.png`
 * is an original whose name happens to end in a size suffix, and stripping it would ask WordPress
 * for a file that does not exist.
 *
 * Only a pure downscale is swapped in. WordPress hard-crops some sizes (`thumbnail` is a square cut
 * out of the frame), so a derivative whose aspect ratio differs from its original was composed by
 * the crop, and replacing it would change what the image shows rather than sharpen it — those are
 * reported for a human instead. The stored object is measured before anything is written, so an
 * asset that no longer holds the derivative it was migrated from is left alone, and an asset this
 * script already upgraded is recognised as such: re-running is a no-op without needing a marker.
 *
 * Originals above imgproxy's source-resolution limit are downscaled to it exactly as the upload UI
 * does (`prepareImageForUpload`) — a handful are 250MP scans, which imgproxy would refuse to render
 * at all.
 *
 * The object is overwritten under its existing key, so nothing that references the asset has to
 * change. Signed imgproxy urls are derived from that key, so they stay valid — and caches keyed by
 * them (imgproxy's own, Next's image optimiser) keep serving the old bytes until they expire.
 *
 * @example
 * 	pnpm run data:backfill:full-resolution-images
 * 	pnpm run data:backfill:full-resolution-images -- --apply
 */

const wordPressApiBaseUrl = "https://www.dariah.eu";

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "full-resolution-images.tsv");

/**
 * Maximum image resolution (total pixels) imgproxy will render. Must match `imageMaxResolution` in
 * `apps/knowledge-base/config/assets.config.ts` and the `IMGPROXY_MAX_SRC_RESOLUTION` setting (in
 * megapixels) of the imgproxy deployment.
 */
const imageMaxResolution = 50 * 1_000_000;

/**
 * How far a derivative's aspect ratio may drift from its original's before it counts as a crop
 * rather than a downscale. WordPress rounds derivative dimensions to whole pixels, which moves the
 * ratio by well under a percent even for the smallest sizes, while a hard crop moves it by tens.
 */
const aspectRatioTolerance = 0.02;

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

interface WordPressMediaItem {
	id: number;
	source_url: string;
	mime_type: string;
	media_details?: {
		width?: number;
		height?: number;
		sizes?: Record<string, { source_url?: string; width?: number; height?: number }>;
	};
}

/**
 * Same `X-WP-TotalPages` pagination contract as the migration's `getAll`, kept local to avoid a
 * cross-package dependency on `@dariah-eric/migrate` for one header-driven loop.
 */
async function fetchAllMedia(apiBaseUrl: string): Promise<Array<WordPressMediaItem>> {
	const url = createUrl({
		baseUrl: apiBaseUrl,
		pathname: "/wp-json/wp/v2/media",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	const results: Array<WordPressMediaItem> = [];

	const response = await fetch(url);
	results.push(...((await response.json()) as Array<WordPressMediaItem>));

	const pages = Number(response.headers.get("X-WP-TotalPages") ?? 1);

	for (let page = 2; page <= pages; page++) {
		url.searchParams.set("page", String(page));
		const pageResponse = await fetch(url);
		results.push(...((await pageResponse.json()) as Array<WordPressMediaItem>));
	}

	return results;
}

interface Dimensions {
	width: number;
	height: number;
}

interface WordPressOriginal {
	mediaId: number;
	/** The `media_details.sizes` entry the stored asset was migrated from. */
	sizeName: string;
	derivative: Dimensions;
	full: Dimensions;
	fullUrl: string;
	mimeType: string;
}

/**
 * Compared on host and path only: the migration copied urls out of post markup, which may spell the
 * host with or without `www.` and percent-encode non-ascii filenames that the media endpoint
 * returns decoded.
 */
function normaliseImageUrl(value: string): string {
	try {
		const url = new URL(value);
		return `${url.host.replace(/^www\./, "")}${decodeURIComponent(url.pathname)}`;
	} catch {
		return value;
	}
}

/**
 * Every derivative url WordPress knows about, mapped to the media item it belongs to. A url two
 * media items both claim is mapped to `undefined` — impossible to resolve, so never acted on.
 */
function indexDerivatives(media: Array<WordPressMediaItem>): Map<string, WordPressOriginal | null> {
	const index = new Map<string, WordPressOriginal | null>();

	for (const item of media) {
		const details = item.media_details;
		const full =
			details?.width != null && details.height != null
				? { width: details.width, height: details.height }
				: undefined;

		if (full == null || details?.sizes == null) {
			continue;
		}

		for (const [sizeName, size] of Object.entries(details.sizes)) {
			if (size.source_url == null || size.width == null || size.height == null) {
				continue;
			}

			const key = normaliseImageUrl(size.source_url);
			const existing = index.get(key);

			// The same file is often registered under several size names (`medium_large` and a theme's
			// own square both land on 768×768); only a second *media item* is ambiguous.
			if (existing !== undefined && existing?.mediaId !== item.id) {
				index.set(key, null);
				continue;
			}

			index.set(key, {
				mediaId: item.id,
				sizeName,
				derivative: { width: size.width, height: size.height },
				full,
				fullUrl: item.source_url,
				mimeType: item.mime_type,
			});
		}
	}

	return index;
}

/** A url ending in WordPress's `-<width>x<height>` derivative suffix, e.g. `…-612x612.webp`. */
const derivativeUrlPattern = /-\d+x\d+\.[a-z0-9]+$/i;

interface CandidateAsset {
	id: string;
	key: string;
	label: string;
	filename: string | null;
	mimeType: string;
	size: number | null;
}

/**
 * Assets whose label is a WordPress upload url ending in a size suffix — the shape
 * `migrateHtmlContent` produced for inline images. Featured images went through
 * `uploadFeaturedImage`, which reads the media item's full `source_url` and labels the asset with
 * its title, so they are not affected and not selected here.
 */
async function findCandidateAssets(): Promise<Array<CandidateAsset>> {
	const assets = await db
		.select({
			id: schema.assets.id,
			key: schema.assets.key,
			label: schema.assets.label,
			filename: schema.assets.filename,
			mimeType: schema.assets.mimeType,
			size: schema.assets.size,
		})
		.from(schema.assets)
		.where(like(schema.assets.label, "%/wp-content/uploads/%"))
		.orderBy(schema.assets.label);

	return assets.filter((asset) => derivativeUrlPattern.test(normaliseImageUrl(asset.label)));
}

type SkipReason =
	| "already-largest"
	| "already-upgraded"
	| "ambiguous-original"
	| "cropped-derivative"
	| "download-failed"
	| "format-changed"
	| "no-wordpress-original"
	| "replaced-since-migration";

interface Decision {
	asset: CandidateAsset;
	original: WordPressOriginal | undefined;
	stored: Dimensions | undefined;
	action: "upgrade" | SkipReason;
	/** What the replacement will hold — the original, or its clamped-down version. */
	upgraded: { image: Buffer; dimensions: Dimensions } | undefined;
}

async function readStoredImage(key: string): Promise<Buffer> {
	const stream = (await storage.download(key)).unwrap();

	const chunks: Array<Buffer> = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
	}

	return Buffer.concat(chunks);
}

/**
 * Downscales an original past imgproxy's source-resolution limit to fit within it, mirroring
 * `prepareImageForUpload` in the dashboard. imgproxy only ever serves much smaller variants, so the
 * extra pixels carry no deliverable value and would break rendering outright.
 */
async function clampToMaxResolution(
	image: Buffer,
	dimensions: Dimensions,
): Promise<{ image: Buffer; dimensions: Dimensions }> {
	const resolution = dimensions.width * dimensions.height;

	if (resolution <= imageMaxResolution) {
		return { image, dimensions };
	}

	const scale = Math.sqrt(imageMaxResolution / resolution);
	const width = Math.floor(dimensions.width * scale);
	const height = Math.floor(dimensions.height * scale);

	const resized = await sharp(image)
		/** Bake EXIF orientation into the pixels before we strip metadata during re-encoding. */
		.rotate()
		.resize({ fit: "inside", height, width })
		.toBuffer();

	return { image: resized, dimensions: { width, height } };
}

function isSameAspectRatio(derivative: Dimensions, full: Dimensions): boolean {
	const derivativeRatio = derivative.width / derivative.height;
	const fullRatio = full.width / full.height;

	return Math.abs(derivativeRatio - fullRatio) / fullRatio <= aspectRatioTolerance;
}

/**
 * Decides one asset's fate, and fetches the replacement image when there is one. Everything that
 * could make the swap wrong is checked here, against the stored object rather than against what the
 * migration is assumed to have left behind.
 */
async function decide(
	asset: CandidateAsset,
	derivatives: Map<string, WordPressOriginal | null>,
	apply: boolean,
): Promise<Decision> {
	const base = { asset, original: undefined, stored: undefined, upgraded: undefined };

	const original = derivatives.get(normaliseImageUrl(asset.label));

	if (original === undefined) {
		return { ...base, action: "no-wordpress-original" };
	}

	if (original === null) {
		return { ...base, action: "ambiguous-original" };
	}

	if (original.mimeType !== asset.mimeType) {
		return { ...base, original, action: "format-changed" };
	}

	if (original.full.width <= original.derivative.width) {
		return { ...base, original, action: "already-largest" };
	}

	if (!isSameAspectRatio(original.derivative, original.full)) {
		return { ...base, original, action: "cropped-derivative" };
	}

	let stored: Dimensions;
	try {
		const image = await readStoredImage(asset.key);
		const metadata = await buffer.getMetadata(image);
		stored = { width: metadata.width, height: metadata.height };
	} catch (error) {
		log.error(`Failed to read the stored object for \`${asset.key}\`: ${String(error)}`);
		return { ...base, original, action: "download-failed" };
	}

	if (stored.width !== original.derivative.width || stored.height !== original.derivative.height) {
		// Bigger than what the migration put there: an earlier run of this script (possibly clamped
		// below the original's own dimensions), or an image an editor improved by hand. Recognising it
		// by the pixels means no marker column is needed. Anything else is not the derivative the label
		// names, so what it *is* is unknown — leave it be.
		const action =
			stored.width > original.derivative.width ? "already-upgraded" : "replaced-since-migration";

		return { ...base, original, stored, action };
	}

	if (!apply) {
		return { ...base, original, stored, action: "upgrade" };
	}

	try {
		const image = await buffer.fromUrl(new URL(original.fullUrl));
		const metadata = await buffer.getMetadata(image);
		const upgraded = await clampToMaxResolution(image, {
			width: metadata.width,
			height: metadata.height,
		});

		return { asset, original, stored, upgraded, action: "upgrade" };
	} catch (error) {
		log.error(`Failed to download \`${original.fullUrl}\`: ${String(error)}`);
		return { ...base, original, stored, action: "download-failed" };
	}
}

function formatDimensions(dimensions: Dimensions | undefined): string {
	return dimensions != null ? `${String(dimensions.width)}×${String(dimensions.height)}` : "";
}

const reportColumns = [
	"action",
	"asset_id",
	"asset_key",
	"asset_label",
	"wordpress_size_name",
	"stored_dimensions",
	"derivative_dimensions",
	"original_dimensions",
	"original_url",
	"stored_bytes",
	"replacement_bytes",
] as const;

async function writeReport(decisions: Array<Decision>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		reportColumns,
		decisions.map((decision) => [
			decision.action,
			decision.asset.id,
			decision.asset.key,
			decision.asset.label,
			decision.original?.sizeName ?? "",
			formatDimensions(decision.stored),
			formatDimensions(decision.original?.derivative),
			formatDimensions(decision.upgraded?.dimensions ?? decision.original?.full),
			decision.original?.fullUrl ?? "",
			decision.asset.size != null ? String(decision.asset.size) : "",
			decision.upgraded != null ? String(decision.upgraded.image.byteLength) : "",
		]),
	);
}

/** Overwrites the object under its existing key, then records its new size. */
async function applyDecision(decision: Decision): Promise<void> {
	const { asset, upgraded } = decision;

	if (upgraded == null) {
		return;
	}

	(
		await storage.replace({
			input: upgraded.image,
			key: asset.key,
			metadata: { "content-type": asset.mimeType, name: asset.filename ?? asset.key },
			size: upgraded.image.byteLength,
		})
	).unwrap();

	await db
		.update(schema.assets)
		.set({ size: upgraded.image.byteLength })
		.where(eq(schema.assets.id, asset.id));
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Fetching WordPress media…");
	const media = await fetchAllMedia(wordPressApiBaseUrl);
	const derivatives = indexDerivatives(media);

	log.info("Loading assets migrated from a WordPress image derivative…");
	const assets = await findCandidateAssets();

	const decisions: Array<Decision> = [];
	let upgraded = 0;

	for (const asset of assets) {
		const decision = await decide(asset, derivatives, apply);
		decisions.push(decision);

		if (decision.action !== "upgrade") {
			continue;
		}

		log.info(
			`  ${asset.key}: ${formatDimensions(decision.stored)} → ${formatDimensions(
				decision.upgraded?.dimensions ?? decision.original?.full,
			)} — ${decision.original!.fullUrl}`,
		);

		if (apply) {
			await applyDecision(decision);
		}

		upgraded += 1;
	}

	await writeReport(decisions);

	const skipped = new Map<string, number>();
	for (const decision of decisions) {
		if (decision.action !== "upgrade") {
			skipped.set(decision.action, (skipped.get(decision.action) ?? 0) + 1);
		}
	}

	log.info(
		`${String(upgraded)} of ${String(assets.length)} assets ${
			apply ? "upgraded" : "to upgrade"
		} to their full-size original.`,
	);
	for (const [reason, count] of [...skipped].toSorted((a, b) => b[1] - a[1])) {
		log.info(`  ${String(count)} skipped: ${reason}`);
	}
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info("Pass `--apply` to replace the stored images.");
		return;
	}

	log.success(`Replaced ${String(upgraded)} images with their full-size original.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
