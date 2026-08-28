import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, count, eq, isNull, like, not } from "@dariah-eric/database/sql";
import { createStorageService } from "@dariah-eric/storage";
import { type Dimensions, buffer, toDisplayDimensions } from "@dariah-eric/storage/lib";

import { env } from "../config/env.config";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Measures the stored object behind every image asset that has no recorded `width`/`height` and
 * writes them back. Dry run by default; `--apply` updates the rows.
 *
 * `uploadAsset` records dimensions for anything uploaded after the `assets.width`/`assets.height`
 * columns landed, but every asset that predates them — including everything migrated from WordPress
 * — has null. Consumers need the source's real resolution to build a `srcset` whose width
 * descriptors are true: imgproxy does not enlarge, so a request for a width above the source's own
 * quietly returns the source size, and a descriptor promising more sends the browser's candidate
 * selection off a cliff. Null therefore has to mean "vector, no upper bound" rather than "not
 * measured yet", which is what this closes.
 *
 * Nothing is re-encoded and no object is written. The stored bytes are read and measured, exactly
 * as they will be read and measured by imgproxy, so a re-run is a no-op and an asset whose object
 * has been replaced since is simply measured as it now stands.
 *
 * Only assets with an `image/*` mime type are looked at. `assets` also holds the documents the
 * richtext link targets point at, which sharp cannot decode and which have no dimensions to
 * record.
 *
 * Vector images are skipped rather than measured. sharp will happily report an svg's viewBox as
 * pixel dimensions, but a vector has no native resolution and no width above which a request stops
 * gaining detail — recording one would truncate a `srcset` that should have no ceiling.
 *
 * @example
 * 	pnpm run data:backfill:image-dimensions
 * 	pnpm run data:backfill:image-dimensions -- --apply
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "image-dimensions.tsv");

/** Vector images have no raster resolution, so there is nothing meaningful to record. */
const vectorMimeType = "image/svg+xml";

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

interface CandidateAsset {
	id: string;
	key: string;
	label: string;
	mimeType: string;
}

/**
 * Only image rows still missing dimensions are considered.
 *
 * The mime-type filter is not an optimisation. `assets` holds every uploaded file, and the
 * `documents` prefix is full of pdfs that the richtext link targets point at — handing one of those
 * to sharp raises "Input buffer contains unsupported image format", so without the filter a run
 * downloads the entire document corpus only to fail on all of it.
 *
 * Matching on `image/%` rather than an allowlist of the four raster types the upload UI accepts, so
 * that anything migrated in a format the dashboard would not accept today (gif and tiff, both of
 * which sharp reads) is measured rather than silently left null.
 *
 * Restricting to null dimensions makes the script restartable: a re-run after a partial apply picks
 * up exactly where it stopped.
 */
async function findCandidateAssets(): Promise<Array<CandidateAsset>> {
	return db
		.select({
			id: schema.assets.id,
			key: schema.assets.key,
			label: schema.assets.label,
			mimeType: schema.assets.mimeType,
		})
		.from(schema.assets)
		.where(and(isNull(schema.assets.width), like(schema.assets.mimeType, "image/%")))
		.orderBy(schema.assets.key);
}

/** Non-image assets keep null dimensions by definition; counted only so a run can say so. */
async function countNonImageAssets(): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(schema.assets)
		.where(and(isNull(schema.assets.width), not(like(schema.assets.mimeType, "image/%"))));

	return row?.total ?? 0;
}

type SkipReason = "download-failed" | "unmeasurable" | "vector";

interface Decision {
	asset: CandidateAsset;
	dimensions: Dimensions | undefined;
	action: "measure" | SkipReason;
}

async function readStoredImage(key: string): Promise<Buffer> {
	const stream = (await storage.download(key)).unwrap();

	const chunks: Array<Buffer> = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
	}

	return Buffer.concat(chunks);
}

async function decide(asset: CandidateAsset): Promise<Decision> {
	const base = { asset, dimensions: undefined };

	if (asset.mimeType === vectorMimeType) {
		return { ...base, action: "vector" };
	}

	let image: Buffer;
	try {
		image = await readStoredImage(asset.key);
	} catch (error) {
		// Storage is unreachable or the object is gone — worth an error, since the row points at
		// something that should be there.
		log.error(`Failed to read the stored object for \`${asset.key}\`: ${String(error)}`);
		return { ...base, action: "download-failed" };
	}

	let dimensions: Dimensions;
	try {
		dimensions = toDisplayDimensions(await buffer.getMetadata(image));
	} catch (error) {
		// The bytes are there, sharp just will not decode them. Expected for the odd exotic upload, so
		// this is a warning rather than an error, and the row keeps its null.
		log.warn(`Cannot measure \`${asset.key}\` (${asset.mimeType}): ${String(error)}`);
		return { ...base, action: "unmeasurable" };
	}

	/** Guards against a file sharp decodes but cannot size, which would write `NaN` columns. */
	if (!Number.isFinite(dimensions.width * dimensions.height)) {
		return { ...base, action: "unmeasurable" };
	}

	return { asset, dimensions, action: "measure" };
}

const reportColumns = [
	"action",
	"asset_id",
	"asset_key",
	"asset_label",
	"mime_type",
	"dimensions",
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
			decision.asset.mimeType,
			decision.dimensions != null
				? `${String(decision.dimensions.width)}×${String(decision.dimensions.height)}`
				: "",
		]),
	);
}

async function applyDecision(decision: Decision): Promise<void> {
	const { asset, dimensions } = decision;

	if (dimensions == null) {
		return;
	}

	await db
		.update(schema.assets)
		.set({ width: dimensions.width, height: dimensions.height })
		.where(eq(schema.assets.id, asset.id));
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	log.info("Loading image assets without recorded dimensions…");
	const [assets, nonImages] = await Promise.all([findCandidateAssets(), countNonImageAssets()]);

	if (nonImages > 0) {
		log.info(`Ignoring ${String(nonImages)} non-image assets (documents keep null dimensions).`);
	}

	const decisions: Array<Decision> = [];
	let measured = 0;

	for (const asset of assets) {
		const decision = await decide(asset);
		decisions.push(decision);

		if (decision.action !== "measure") {
			continue;
		}

		log.info(
			`  ${asset.key}: ${String(decision.dimensions!.width)}×${String(decision.dimensions!.height)}`,
		);

		if (apply) {
			await applyDecision(decision);
		}

		measured += 1;
	}

	await writeReport(decisions);

	const skipped = new Map<string, number>();
	for (const decision of decisions) {
		if (decision.action !== "measure") {
			skipped.set(decision.action, (skipped.get(decision.action) ?? 0) + 1);
		}
	}

	log.info(
		`${String(measured)} of ${String(assets.length)} assets ${apply ? "measured" : "to measure"}.`,
	);
	for (const [reason, count] of [...skipped].toSorted((a, b) => b[1] - a[1])) {
		log.info(`  ${String(count)} skipped: ${reason}`);
	}
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info("Pass `--apply` to record the measured dimensions.");
		return;
	}

	log.success(`Recorded dimensions for ${String(measured)} assets.`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
