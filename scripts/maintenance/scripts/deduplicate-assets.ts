import { createHash } from "node:crypto";
import * as path from "node:path";
import type { Readable } from "node:stream";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { sql } from "@dariah-eric/database/sql";
import { createStorageService } from "@dariah-eric/storage";
import sharp from "sharp";

import { env } from "../config/env.config";
import { writeTsvReport } from "../lib/tsv-report";

/**
 * Finds binary-identical image assets and repoints every reference to one canonical asset. Dry run
 * by default; pass `--apply` to update database references. This does not delete stale asset rows
 * or storage objects — run `data:clean:unused-assets` afterwards to remove the now-unused
 * duplicates.
 *
 * Duplicates are matched by mime type, file size, image dimensions and SHA-256 hash of the stored
 * object. References are rewritten both by id (foreign keys to `assets.id`) and by key (exact
 * string values embedded in JSON/rich-text columns).
 *
 * @example
 * 	pnpm run data:deduplicate:assets
 * 	pnpm run data:deduplicate:assets -- --label hiring-banner
 * 	pnpm run data:deduplicate:assets -- --key images/...
 * 	pnpm run data:deduplicate:assets -- --label hiring-banner --apply
 * 	pnpm run data:deduplicate:assets -- --canonical-key images/...
 */

const cacheFolderPath = path.join(process.cwd(), ".cache");
const reportFilePath = path.join(cacheFolderPath, "duplicate-assets.tsv");

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

type QueryExecutor = Pick<typeof db, "execute">;

interface CandidateAsset {
	id: string;
	key: string;
	label: string;
	mimeType: string;
	size: number;
	createdAt: string;
}

interface FingerprintedAsset extends CandidateAsset {
	width: number | null;
	height: number | null;
	sha256: string;
}

interface CatalogColumn {
	schema: string;
	table: string;
	column: string;
	dataType?: string;
}

interface DuplicatePlan {
	canonical: FingerprintedAsset;
	stale: FingerprintedAsset;
	fingerprint: string;
	foreignKeyReferences: number;
	jsonReferences: number;
}

function readFlagValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	const value = process.argv[index + 1];

	if (index === -1 || value == null || value.startsWith("--")) {
		return undefined;
	}

	return value;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Array<Buffer> = [];

	for await (const chunk of stream) {
		// oxlint-disable-next-line typescript/no-unsafe-argument
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	return Buffer.concat(chunks);
}

function groupBy<T>(items: Array<T>, getKey: (item: T) => string): Map<string, Array<T>> {
	const groups = new Map<string, Array<T>>();

	for (const item of items) {
		const key = getKey(item);
		const group = groups.get(key);

		if (group == null) {
			groups.set(key, [item]);
		} else {
			group.push(item);
		}
	}

	return groups;
}

function chooseCanonical(
	assets: Array<FingerprintedAsset>,
	canonicalKey: string | undefined,
): FingerprintedAsset {
	const requested =
		canonicalKey != null ? assets.find((asset) => asset.key === canonicalKey) : null;

	if (requested != null) {
		return requested;
	}

	return assets.toSorted((a, b) => {
		const createdAt = a.createdAt.localeCompare(b.createdAt);
		return createdAt !== 0 ? createdAt : a.id.localeCompare(b.id);
	})[0]!;
}

async function findCandidateAssets(filters: {
	label: string | undefined;
}): Promise<Array<CandidateAsset>> {
	const conditions = [sql`mime_type like 'image/%'`, sql`size is not null`];

	if (filters.label != null) {
		conditions.push(sql`label ilike ${`%${filters.label}%`}`);
	}

	const result = await db.execute<{
		id: string;
		key: string;
		label: string;
		mime_type: string;
		size: string;
		created_at: string;
	}>(sql`
		select id::text, key, label, mime_type, size::text, created_at::text
		from assets
		where ${sql.join(conditions, sql` and `)}
		order by created_at, id
	`);

	return result.rows.map((row) => {
		return {
			id: row.id,
			key: row.key,
			label: row.label,
			mimeType: row.mime_type,
			size: Number(row.size),
			createdAt: row.created_at,
		};
	});
}

async function fingerprintAsset(asset: CandidateAsset): Promise<FingerprintedAsset | null> {
	try {
		const stream = (await storage.download(asset.key)).unwrap();
		const buffer = await streamToBuffer(stream);
		const metadata = await sharp(buffer).metadata();

		return {
			...asset,
			width: metadata.width ?? null,
			height: metadata.height ?? null,
			sha256: createHash("sha256").update(buffer).digest("hex"),
		};
	} catch (error) {
		log.error(`Could not fingerprint \`${asset.key}\`: ${String(error)}`);
		return null;
	}
}

async function getForeignKeyColumns(): Promise<Array<CatalogColumn>> {
	const result = await db.execute<{
		schema_name: string;
		table_name: string;
		column_name: string;
	}>(sql`
		select
			n.nspname as schema_name,
			cl.relname as table_name,
			a.attname as column_name
		from pg_constraint c
		join pg_class cl on cl.oid = c.conrelid
		join pg_namespace n on n.oid = cl.relnamespace
		join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
		where c.confrelid = to_regclass('assets') and c.contype = 'f'
	`);

	return result.rows.map((row) => {
		return { schema: row.schema_name, table: row.table_name, column: row.column_name };
	});
}

async function getJsonColumns(): Promise<Array<CatalogColumn>> {
	const result = await db.execute<{
		table_schema: string;
		table_name: string;
		column_name: string;
		data_type: string;
	}>(sql`
		select
			columns.table_schema,
			columns.table_name,
			columns.column_name,
			columns.data_type
		from information_schema.columns as columns
		join pg_namespace as namespace on namespace.nspname = columns.table_schema
		join pg_class as relation on relation.relnamespace = namespace.oid
			and relation.relname = columns.table_name
		where columns.table_schema not in ('pg_catalog', 'information_schema')
			and columns.data_type in ('jsonb', 'json')
			and relation.relkind = 'r'
	`);

	return result.rows.map((row) => {
		return {
			schema: row.table_schema,
			table: row.table_name,
			column: row.column_name,
			dataType: row.data_type,
		};
	});
}

function qualifiedTable(column: CatalogColumn) {
	return sql`${sql.identifier(column.schema)}.${sql.identifier(column.table)}`;
}

function qualifiedColumn(column: CatalogColumn) {
	return sql`${sql.identifier(column.schema)}.${sql.identifier(column.table)}.${sql.identifier(column.column)}`;
}

async function countForeignKeyReferences(
	columns: Array<CatalogColumn>,
	staleId: string,
): Promise<number> {
	let total = 0;

	for (const column of columns) {
		const result = await db.execute<{ count: string }>(sql`
			select count(*)::text as count
			from ${qualifiedTable(column)}
			where ${qualifiedColumn(column)} = ${staleId}
		`);

		total += Number(result.rows[0]?.count ?? 0);
	}

	return total;
}

function rewriteAssetKeys(value: unknown, keyMap: ReadonlyMap<string, string>): unknown {
	if (typeof value === "string") {
		return keyMap.get(value) ?? value;
	}

	if (Array.isArray(value)) {
		let changed = false;
		const next = value.map((item) => {
			const rewritten = rewriteAssetKeys(item, keyMap);
			changed ||= rewritten !== item;
			return rewritten;
		});

		return changed ? next : value;
	}

	if (value != null && typeof value === "object") {
		let changed = false;
		const entries = Object.entries(value).map(([key, item]) => {
			const rewritten = rewriteAssetKeys(item, keyMap);
			changed ||= rewritten !== item;
			return [key, rewritten] as const;
		});

		return changed ? Object.fromEntries(entries) : value;
	}

	return value;
}

function jsonbSearchPredicate(column: CatalogColumn, staleKeys: Array<string>) {
	const keyValues = sql.join(
		staleKeys.map((key) => sql`(${key})`),
		sql`, `,
	);

	return sql`exists (
		select 1
		from (values ${keyValues}) as stale(key)
		where ${qualifiedColumn(column)}::text like '%' || stale.key || '%'
	)`;
}

async function countJsonReferences(
	columns: Array<CatalogColumn>,
	keyMap: ReadonlyMap<string, string>,
): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	const staleKeys = Array.from(keyMap.keys());

	for (const column of columns) {
		const result = await db.execute<{ value: unknown }>(sql`
			select ${qualifiedColumn(column)} as value
			from ${qualifiedTable(column)}
			where ${jsonbSearchPredicate(column, staleKeys)}
		`);

		for (const row of result.rows) {
			countJsonValue(row.value, keyMap, counts);
		}
	}

	return counts;
}

function countJsonValue(
	value: unknown,
	keyMap: ReadonlyMap<string, string>,
	counts: Map<string, number>,
): void {
	if (typeof value === "string") {
		if (keyMap.has(value)) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			countJsonValue(item, keyMap, counts);
		}
		return;
	}

	if (value != null && typeof value === "object") {
		for (const item of Object.values(value)) {
			countJsonValue(item, keyMap, counts);
		}
	}
}

async function applyForeignKeyReferences(
	executor: QueryExecutor,
	columns: Array<CatalogColumn>,
	staleId: string,
	canonicalId: string,
): Promise<number> {
	let total = 0;

	for (const column of columns) {
		const result = await executor.execute<{ id: string }>(sql`
			update ${qualifiedTable(column)}
			set ${sql.identifier(column.column)} = ${canonicalId}
			where ${sql.identifier(column.column)} = ${staleId}
			returning ${sql.identifier(column.column)}::text as id
		`);

		total += result.rows.length;
	}

	return total;
}

async function applyJsonReferences(
	executor: QueryExecutor,
	columns: Array<CatalogColumn>,
	keyMap: ReadonlyMap<string, string>,
): Promise<number> {
	let total = 0;
	const staleKeys = Array.from(keyMap.keys());

	for (const column of columns) {
		const matches = await executor.execute<{ row_id: string; value: unknown }>(sql`
			select ctid::text as row_id, ${qualifiedColumn(column)} as value
			from ${qualifiedTable(column)}
			where ${jsonbSearchPredicate(column, staleKeys)}
		`);

		for (const row of matches.rows) {
			const next = rewriteAssetKeys(row.value, keyMap);

			if (next === row.value) {
				continue;
			}

			const cast = column.dataType === "json" ? sql`json` : sql`jsonb`;

			await executor.execute(sql`
				update ${qualifiedTable(column)}
				set ${sql.identifier(column.column)} = ${JSON.stringify(next)}::${cast}
				where ctid = ${row.row_id}::tid
			`);

			total += 1;
		}
	}

	return total;
}

async function createDuplicatePlans(options: {
	canonicalKey: string | undefined;
	key: string | undefined;
	label: string | undefined;
}): Promise<Array<DuplicatePlan>> {
	const candidates = await findCandidateAssets({ label: options.label });
	const possibleDuplicateGroups = Array.from(
		groupBy(candidates, (asset) => `${asset.mimeType}\0${String(asset.size)}`).values(),
	).filter((group) => group.length > 1);

	log.info(
		`Fingerprinting ${String(possibleDuplicateGroups.reduce((sum, group) => sum + group.length, 0))} candidate asset(s) from ${String(possibleDuplicateGroups.length)} size/mime group(s)...`,
	);

	const fingerprinted: Array<FingerprintedAsset> = [];

	for (const group of possibleDuplicateGroups) {
		for (const asset of group) {
			const fingerprint = await fingerprintAsset(asset);
			if (fingerprint != null) {
				fingerprinted.push(fingerprint);
			}
		}
	}

	const duplicateGroups = Array.from(
		groupBy(fingerprinted, (asset) =>
			[
				asset.mimeType,
				String(asset.size),
				String(asset.width ?? ""),
				String(asset.height ?? ""),
				asset.sha256,
			].join("\0"),
		).values(),
	).filter((group) => group.length > 1);

	const foreignKeyColumns = await getForeignKeyColumns();
	const jsonColumns = await getJsonColumns();
	const plans: Array<DuplicatePlan> = [];

	for (const group of duplicateGroups) {
		if (options.key != null && !group.some((asset) => asset.key === options.key)) {
			continue;
		}

		if (
			options.canonicalKey != null &&
			!group.some((asset) => asset.key === options.canonicalKey)
		) {
			continue;
		}

		const canonical = chooseCanonical(group, options.canonicalKey);
		const staleAssets = group.filter((asset) => asset.id !== canonical.id);
		const keyMap = new Map(staleAssets.map((asset) => [asset.key, canonical.key] as const));
		const jsonReferenceCounts = await countJsonReferences(jsonColumns, keyMap);

		for (const stale of staleAssets) {
			plans.push({
				canonical,
				stale,
				fingerprint: stale.sha256,
				foreignKeyReferences: await countForeignKeyReferences(foreignKeyColumns, stale.id),
				jsonReferences: jsonReferenceCounts.get(stale.key) ?? 0,
			});
		}
	}

	return plans;
}

async function writeReport(plans: Array<DuplicatePlan>): Promise<void> {
	await writeTsvReport(
		reportFilePath,
		[
			"canonical_id",
			"canonical_key",
			"canonical_label",
			"stale_id",
			"stale_key",
			"stale_label",
			"mime_type",
			"size",
			"width",
			"height",
			"sha256",
			"foreign_key_references",
			"json_references",
		],
		plans.map((plan) => [
			plan.canonical.id,
			plan.canonical.key,
			plan.canonical.label,
			plan.stale.id,
			plan.stale.key,
			plan.stale.label,
			plan.stale.mimeType,
			String(plan.stale.size),
			plan.stale.width != null ? String(plan.stale.width) : "",
			plan.stale.height != null ? String(plan.stale.height) : "",
			plan.fingerprint,
			String(plan.foreignKeyReferences),
			String(plan.jsonReferences),
		]),
	);
}

async function main(): Promise<void> {
	const apply = process.argv.includes("--apply");
	const label = readFlagValue("--label");
	const key = readFlagValue("--key");
	const canonicalKey = readFlagValue("--canonical-key");

	log.info(
		apply
			? "Finding duplicate assets and rewriting references..."
			: "Finding duplicate assets (dry run; pass `--apply` to rewrite references)...",
	);

	const plans = await createDuplicatePlans({ canonicalKey, key, label });
	await writeReport(plans);

	const staleAssets = new Set(plans.map((plan) => plan.stale.id));
	const foreignKeyReferences = plans.reduce((sum, plan) => sum + plan.foreignKeyReferences, 0);
	const jsonReferences = plans.reduce((sum, plan) => sum + plan.jsonReferences, 0);

	log.success(
		`Found ${String(staleAssets.size)} duplicate asset(s), ${String(foreignKeyReferences)} foreign-key reference(s), ${String(jsonReferences)} JSON reference(s). Report: ${reportFilePath}`,
	);

	if (!apply || plans.length === 0) {
		return;
	}

	const foreignKeyColumns = await getForeignKeyColumns();
	const jsonColumns = await getJsonColumns();
	const keyMap = new Map(plans.map((plan) => [plan.stale.key, plan.canonical.key] as const));

	let rewrittenForeignKeys = 0;
	let rewrittenJsonRows = 0;

	await db.transaction(async (tx) => {
		for (const plan of plans) {
			rewrittenForeignKeys += await applyForeignKeyReferences(
				tx,
				foreignKeyColumns,
				plan.stale.id,
				plan.canonical.id,
			);
		}

		rewrittenJsonRows = await applyJsonReferences(tx, jsonColumns, keyMap);
	});

	log.info(
		`Done. Rewrote ${String(rewrittenForeignKeys)} foreign-key reference(s) and ${String(rewrittenJsonRows)} JSON row(s). Run \`data:clean:unused-assets\` next to review stale assets for deletion.`,
	);
}

try {
	await main();
} catch (error) {
	log.error(error);
	process.exitCode = 1;
} finally {
	await db.$client.end().catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	});
}
