import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { eq } from "@dariah-eric/database/sql";
import { createStorageService } from "@dariah-eric/storage";

import { env } from "../config/env.config";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Copies the documents that rich-text links still point at on WordPress into our own storage, and
 * repoints those links at the stored asset. Dry run by default; `--apply` uploads and rewrites.
 *
 * The WordPress migration brought images across but not files: a link like `<a
 * href="…/wp-content/uploads/2026/04/flyer.pdf">Click here to see the flyer</a>` was copied
 * verbatim, so every linked pdf on the site is still served by WordPress and disappears with it.
 *
 * Each distinct url becomes one asset (under `documents`, or `images` for an image), labelled with
 * the url it came from — the same convention `migrateHtmlContent` used for images, which is what
 * makes this re-runnable: a url that already has an asset is reused rather than uploaded twice.
 *
 * The links are then rewritten to the target model in `@dariah-eric/database/link-targets`: the
 * mark keeps its text, drops its `href`, and gains `targetKind: "asset"` plus the asset's storage
 * key. Read paths resolve that key to a download url, so the link survives the WordPress site going
 * away. A rewritten link no longer carries a matching href, so re-running finds nothing.
 *
 * Every rich-text-bearing content block is scanned — `rich_text`, `callout`, `media_text` and
 * `accordion` item bodies — across all versions, draft and published alike.
 *
 * Any `uploads/` url ending in a known file extension is taken, images included — see
 * {@link documentMimeTypes}.
 *
 * A file that will not transfer — dariah.eu drops the largest of them mid-stream — can be fetched
 * by hand and dropped in a folder passed as `--files=…`. Any file there whose name matches the
 * url's is used instead of downloading it, so an operator never has to hand-edit the database to
 * get past one stubborn url. Everything else about that document is unchanged, and the report says
 * `copied` rather than `downloaded`.
 *
 * @example
 * 	pnpm run data:backfill:linked-documents
 * 	pnpm run data:backfill:linked-documents -- --apply
 * 	pnpm run data:backfill:linked-documents -- --apply --files=~/downloads
 */

/** Generous, because the largest of these is a 55MB bundle served from a slow origin. */
const downloadTimeout = 10 * 60 * 1000;

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "linked-documents.tsv");

/**
 * Extensions we treat as a linked file, with the mime type to store them under.
 *
 * Images are included. A `wp-content/uploads/` url _is_ the file — WordPress attachment pages carry
 * no extension — so a link to a png is a link to a file, not to a page, and is exactly as fragile
 * as a link to a pdf. (The images the migration already brought across were inline `<img>` sources,
 * which is a different thing entirely.)
 */
const documentMimeTypes = new Map([
	["pdf", "application/pdf"],
	["doc", "application/msword"],
	["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
	["xls", "application/vnd.ms-excel"],
	["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
	["ppt", "application/vnd.ms-powerpoint"],
	["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
	["txt", "text/plain"],
	["zip", "application/zip"],
	["png", "image/png"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["webp", "image/webp"],
	["gif", "image/gif"],
	["svg", "image/svg+xml"],
]);

/** Images belong in the `images` prefix, so the media library lists them where editors expect. */
function prefixFor(mimeType: string): "documents" | "images" {
	return mimeType.startsWith("image/") ? "images" : "documents";
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The href of a `link` mark that points at a WordPress-hosted document, or `null`. */
function getDocumentHref(value: unknown): string | null {
	if (!isRecord(value) || value.type !== "link") {
		return null;
	}

	const attrs = value.attrs;
	if (!isRecord(attrs) || typeof attrs.href !== "string") {
		return null;
	}

	return isDocumentUrl(attrs.href) ? attrs.href : null;
}

function isDocumentUrl(href: string): boolean {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return false;
	}

	if (!url.host.replace(/^www\./, "").endsWith("dariah.eu")) {
		return false;
	}
	if (!url.pathname.includes("/wp-content/uploads/")) {
		return false;
	}

	return documentMimeTypes.has(extensionOf(url));
}

function extensionOf(url: URL): string {
	return path.extname(decodeURIComponent(url.pathname)).replace(".", "").toLowerCase();
}

/** Compared on host and path, so `http`/`https` and `www.` spellings of one file are one url. */
function normaliseUrl(href: string): string {
	try {
		const url = new URL(href);
		return `${url.host.replace(/^www\./, "")}${decodeURIComponent(url.pathname)}`;
	} catch {
		return href;
	}
}

/** Every document href in a JSON structure, keyed by its normalised form. */
function collectDocumentHrefs(
	value: unknown,
	into = new Map<string, string>(),
): Map<string, string> {
	function visit(node: unknown) {
		if (Array.isArray(node)) {
			for (const item of node) {
				visit(item);
			}
			return;
		}

		if (!isRecord(node)) {
			return;
		}

		const href = getDocumentHref(node);
		if (href != null) {
			into.set(normaliseUrl(href), href);
		}

		for (const item of Object.values(node)) {
			visit(item);
		}
	}

	visit(value);

	return into;
}

/**
 * Repoints every matched link at its asset: the href goes, the reference arrives. Returns the input
 * reference unchanged when nothing matched, so untouched rows are never rewritten.
 */
function rewriteDocumentLinks<T>(value: T, assetKeys: ReadonlyMap<string, string>): T {
	function rewrite(node: unknown): unknown {
		if (Array.isArray(node)) {
			let changed = false;
			const result = node.map((item) => {
				const next = rewrite(item);
				changed ||= next !== item;
				return next;
			});
			return changed ? result : node;
		}

		if (!isRecord(node)) {
			return node;
		}

		const href = getDocumentHref(node);
		if (href != null) {
			const assetKey = assetKeys.get(normaliseUrl(href));
			if (assetKey == null) {
				return node;
			}

			return {
				...node,
				attrs: {
					...(node.attrs as Record<string, unknown>),
					href: null,
					targetKind: "asset",
					assetKey,
				},
			};
		}

		let changed = false;
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(node)) {
			const next = rewrite(item);
			changed ||= next !== item;
			result[key] = next;
		}
		return changed ? result : node;
	}

	return rewrite(value) as T;
}

/** One rich-text-bearing column of one content block. */
interface Target {
	table: "media_text" | "rich_text";
	blockId: string;
	content: unknown;
}

async function findTargets(): Promise<Array<Target>> {
	// Two tables, not four: a callout's body and an accordion panel's body are `rich_text` blocks of
	// their own now, so they arrive with everything else stored that way.
	const [richText, mediaText] = await Promise.all([
		db
			.select({
				blockId: schema.richTextContentBlocks.id,
				content: schema.richTextContentBlocks.content,
			})
			.from(schema.richTextContentBlocks),
		db
			.select({
				blockId: schema.mediaTextContentBlocks.id,
				content: schema.mediaTextContentBlocks.content,
			})
			.from(schema.mediaTextContentBlocks),
	]);

	return [
		...richText.map((row): Target => {
			return { table: "rich_text", ...row };
		}),
		...mediaText.map((row): Target => {
			return { table: "media_text", ...row };
		}),
	];
}

interface Document {
	/** The url as stored in the link, used verbatim as the asset label. */
	url: string;
	extension: string;
	mimeType: string;
	filename: string;
	occurrences: number;
	/** Set once the file exists in our storage. */
	assetKey?: string;
	action: "copied" | "downloaded" | "failed" | "reused" | "to-download";
	size?: number;
}

/** The asset a previous run already created for this url, if any. */
async function findExistingAsset(
	url: string,
): Promise<{ key: string; size: number | null } | null> {
	const [asset] = await db
		.select({ key: schema.assets.key, size: schema.assets.size })
		.from(schema.assets)
		.where(eq(schema.assets.label, url))
		.limit(1);

	return asset ?? null;
}

/**
 * These run to tens of megabytes — one conference poster bundle is 55MB — so the default fetch
 * timeout is not enough for the slowest of them.
 *
 * Buffered rather than streamed, deliberately: `stream.fromUrl` surfaces a stalled download as an
 * `error` event on the stream itself, asynchronously, which takes the whole run down instead of
 * failing this one document and moving on.
 */
async function ingest(document: Document, localFolderPath: string | null): Promise<void> {
	const localPath = localFolderPath != null ? path.join(localFolderPath, document.filename) : null;
	const isLocal = localPath != null && existsSync(localPath);

	const file = isLocal ? await fs.readFile(localPath) : await download(document.url);
	const size = file.byteLength;

	const { key } = (
		await storage.upload({
			prefix: prefixFor(document.mimeType),
			input: file,
			metadata: { "content-type": document.mimeType, name: document.filename },
			size,
		})
	).unwrap();

	await db.insert(schema.assets).values({
		key,
		// The source url verbatim, matching how the migration labelled the images it copied — and what
		// makes a re-run recognise this document as already ingested.
		label: document.url,
		filename: document.filename,
		mimeType: document.mimeType,
		size,
	});

	document.assetKey = key;
	document.size = size;
	document.action = isLocal ? "copied" : "downloaded";
}

async function download(url: string): Promise<Buffer> {
	const response = await fetch(url, { signal: AbortSignal.timeout(downloadTimeout) });

	if (!response.ok) {
		throw new Error(`WordPress answered ${String(response.status)}.`);
	}

	return Buffer.from(await response.arrayBuffer());
}

const reportColumns = [
	"action",
	"url",
	"extension",
	"filename",
	"occurrences",
	"asset_key",
	"bytes",
] as const;

async function writeReport(documents: Array<Document>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		reportColumns,
		documents.map((document) => [
			document.action,
			document.url,
			document.extension,
			document.filename,
			String(document.occurrences),
			document.assetKey ?? "",
			document.size != null ? String(document.size) : "",
		]),
	);
}

/** Expands a leading `~`, which a shell does not do inside `--files=…`. */
function resolveFolderPath(value: string): string {
	return value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : path.resolve(value);
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");

	const localFolder = process.argv.find((argument) => argument.startsWith("--files="));
	const localFolderPath =
		localFolder != null ? resolveFolderPath(localFolder.slice("--files=".length)) : null;

	if (localFolderPath != null) {
		log.info(`Taking files from \`${localFolderPath}\` where one matches by name.`);
	}

	log.info("Loading rich-text content blocks…");
	const targets = await findTargets();

	const hrefs = new Map<string, string>();
	const occurrences = new Map<string, number>();

	for (const target of targets) {
		const found = collectDocumentHrefs(target.content);
		for (const [key, href] of found) {
			hrefs.set(key, href);
			occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
		}
	}

	log.info(
		`${String(hrefs.size)} distinct linked document(s) across ${String(targets.length)} blocks.`,
	);

	const documents: Array<Document> = [];

	for (const [normalised, url] of hrefs) {
		const extension = extensionOf(new URL(url));
		const document: Document = {
			url,
			extension,
			mimeType: documentMimeTypes.get(extension)!,
			filename: path.basename(decodeURIComponent(new URL(url).pathname)),
			occurrences: occurrences.get(normalised)!,
			action: "to-download",
		};

		const existing = await findExistingAsset(url);
		if (existing != null) {
			document.assetKey = existing.key;
			document.size = existing.size ?? undefined;
			document.action = "reused";
		} else if (apply) {
			try {
				await ingest(document, localFolderPath);
			} catch (error) {
				document.action = "failed";
				log.error(`Failed to ingest ${url}: ${String(error)}`);
			}
		}

		documents.push(document);
	}

	await writeReport(documents);

	// On a dry run no asset exists yet for a `to-download` url, so the rewrite is counted against a
	// stand-in key. Nothing is written in that mode, and the stand-in never reaches a real key map.
	const assetKeys = new Map<string, string>();
	for (const document of documents) {
		const key = document.assetKey ?? (apply ? null : "(pending)");
		if (key != null) {
			assetKeys.set(normaliseUrl(document.url), key);
		}
	}

	let rewritten = 0;

	for (const target of targets) {
		const next = rewriteDocumentLinks(target.content, assetKeys);
		if (next === target.content) {
			continue;
		}

		rewritten += 1;

		if (!apply) {
			continue;
		}

		switch (target.table) {
			case "rich_text": {
				await db
					.update(schema.richTextContentBlocks)
					.set({ content: next as never })
					.where(eq(schema.richTextContentBlocks.id, target.blockId));
				break;
			}
			case "media_text": {
				await db
					.update(schema.mediaTextContentBlocks)
					.set({ content: next as never })
					.where(eq(schema.mediaTextContentBlocks.id, target.blockId));
				break;
			}
		}
	}

	const counts = new Map<string, number>();
	for (const document of documents) {
		counts.set(document.action, (counts.get(document.action) ?? 0) + 1);
	}
	for (const [action, count] of [...counts].toSorted((a, b) => b[1] - a[1])) {
		log.info(`  ${String(count)} ${action}`);
	}

	log.info(`${String(rewritten)} content block(s) ${apply ? "rewritten" : "to rewrite"}.`);
	log.info(`Report written to \`${reportFilePath}\`.`);

	if (!apply) {
		log.info("Pass `--apply` to ingest the documents and repoint the links.");
		return;
	}

	log.success(`Ingested the linked documents and repointed ${String(rewritten)} content block(s).`);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
