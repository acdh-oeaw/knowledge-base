import { sql } from "drizzle-orm";

import {
	type CatalogColumn,
	getForeignKeyColumns,
	qualifiedColumn,
	qualifiedTable,
} from "./cleanup-references";
import type { Database, Transaction } from "./index";

export interface DuplicateAssetCandidate {
	id: string;
	key: string;
	label: string;
	mimeType: string;
	size: number;
	createdAt: string;
}

export interface AssetFingerprint {
	sha256: string;
	width: number | null;
	height: number | null;
}

export interface DuplicateAsset extends DuplicateAssetCandidate, AssetFingerprint {
	foreignKeyReferences: number;
	jsonReferences: number;
}

export interface DuplicateAssetGroup {
	fingerprint: string;
	assets: Array<DuplicateAsset>;
}

export type FingerprintAsset = (asset: DuplicateAssetCandidate) => Promise<AssetFingerprint | null>;

interface JsonColumn extends CatalogColumn {
	dataType: string;
}

async function getJsonColumns(db: Database | Transaction): Promise<Array<JsonColumn>> {
	const result = await db.execute<{
		table_schema: string;
		table_name: string;
		column_name: string;
		data_type: string;
	}>(sql`
		select table_schema, table_name, column_name, data_type
		from information_schema.columns
		where table_schema not in ('pg_catalog', 'information_schema')
			and data_type in ('jsonb', 'json')
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

function groupBy<T>(items: Array<T>, getKey: (item: T) => string): Array<Array<T>> {
	const groups = new Map<string, Array<T>>();
	for (const item of items) {
		const key = getKey(item);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return Array.from(groups.values());
}

function countJsonValue(value: unknown, key: string): number {
	if (typeof value === "string") {
		return value === key ? 1 : 0;
	}
	if (Array.isArray(value)) {
		return value.reduce((total: number, item) => total + countJsonValue(item, key), 0);
	}
	if (value != null && typeof value === "object") {
		return Object.values(value).reduce(
			(total: number, item) => total + countJsonValue(item, key),
			0,
		);
	}
	return 0;
}

function rewriteJsonValue(value: unknown, staleKey: string, canonicalKey: string): unknown {
	if (typeof value === "string") {
		return value === staleKey ? canonicalKey : value;
	}
	if (Array.isArray(value)) {
		const next = value.map((item) => rewriteJsonValue(item, staleKey, canonicalKey));
		return next.some((item, index) => item !== value[index]) ? next : value;
	}
	if (value != null && typeof value === "object") {
		const entries = Object.entries(value);
		const nextEntries = entries.map(
			([key, item]) => [key, rewriteJsonValue(item, staleKey, canonicalKey)] as const,
		);
		return nextEntries.some((entry, index) => entry[1] !== entries[index]![1])
			? Object.fromEntries(nextEntries)
			: value;
	}
	return value;
}

async function countReferences(
	db: Database | Transaction,
	asset: DuplicateAssetCandidate,
	foreignKeys: Array<CatalogColumn>,
	jsonColumns: Array<JsonColumn>,
): Promise<{ foreignKeyReferences: number; jsonReferences: number }> {
	let foreignKeyReferences = 0;
	for (const column of foreignKeys) {
		const result = await db.execute<{ count: string }>(sql`
			select count(*)::text as count from ${qualifiedTable(column)}
			where ${qualifiedColumn(column)} = ${asset.id}
		`);
		foreignKeyReferences += Number(result.rows[0]?.count ?? 0);
	}

	let jsonReferences = 0;
	for (const column of jsonColumns) {
		const result = await db.execute<{ value: unknown }>(sql`
			select ${qualifiedColumn(column)} as value from ${qualifiedTable(column)}
			where ${qualifiedColumn(column)}::text like '%' || ${asset.key} || '%'
		`);
		for (const row of result.rows) {
			jsonReferences += countJsonValue(row.value, asset.key);
		}
	}
	return { foreignKeyReferences, jsonReferences };
}

export async function findDuplicateAssets(
	db: Database | Transaction,
	fingerprintAsset: FingerprintAsset,
	options: { label?: string } = {},
): Promise<Array<DuplicateAssetGroup>> {
	const labelFilter = options.label?.trim();
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
		where mime_type like 'image/%' and size is not null
			${labelFilter != null && labelFilter !== "" ? sql`and label ilike ${`%${labelFilter}%`}` : sql``}
		order by created_at, id
	`);
	const candidates = result.rows.map((row): DuplicateAssetCandidate => {
		return {
			id: row.id,
			key: row.key,
			label: row.label,
			mimeType: row.mime_type,
			size: Number(row.size),
			createdAt: row.created_at,
		};
	});
	const possibleGroups = groupBy(
		candidates,
		(asset) => `${asset.mimeType}\0${String(asset.size)}`,
	).filter((group) => group.length > 1);
	const fingerprinted: Array<DuplicateAssetCandidate & AssetFingerprint> = [];
	for (const group of possibleGroups) {
		for (const asset of group) {
			const fingerprint = await fingerprintAsset(asset);
			if (fingerprint != null) {
				fingerprinted.push({ ...asset, ...fingerprint });
			}
		}
	}

	const foreignKeys = await getForeignKeyColumns(db, "assets");
	const jsonColumns = await getJsonColumns(db);
	const duplicateGroups = groupBy(fingerprinted, (asset) =>
		[asset.mimeType, asset.size, asset.width, asset.height, asset.sha256].join("\0"),
	).filter((group) => group.length > 1);

	return Promise.all(
		duplicateGroups.map(async (group) => {
			return {
				fingerprint: group[0]!.sha256,
				assets: await Promise.all(
					group.map(async (asset) => {
						return {
							...asset,
							...(await countReferences(db, asset, foreignKeys, jsonColumns)),
						};
					}),
				),
			};
		}),
	);
}

export interface MergeDuplicateAssetsResult {
	rewrittenForeignKeys: number;
	rewrittenJsonRows: number;
	mergedAssetIds: Array<string>;
}

export async function mergeDuplicateAssets(
	db: Database,
	canonicalId: string,
	staleIds: Array<string>,
	fingerprintAsset: FingerprintAsset,
): Promise<MergeDuplicateAssetsResult> {
	const requested = new Set([canonicalId, ...staleIds]);
	const groups = await findDuplicateAssets(db, fingerprintAsset);
	const group = groups.find((item) => item.assets.some((asset) => asset.id === canonicalId));
	if (
		group == null ||
		!Array.from(requested).every((id) => group.assets.some((a) => a.id === id))
	) {
		throw new Error("The selected assets are no longer binary-identical.");
	}
	const canonical = group.assets.find((asset) => asset.id === canonicalId)!;
	const stale = group.assets.filter((asset) => staleIds.includes(asset.id));
	const foreignKeys = await getForeignKeyColumns(db, "assets");
	const jsonColumns = await getJsonColumns(db);
	let rewrittenForeignKeys = 0;
	let rewrittenJsonRows = 0;

	await db.transaction(async (tx) => {
		for (const asset of stale) {
			for (const column of foreignKeys) {
				const result = await tx.execute(sql`
					update ${qualifiedTable(column)} set ${sql.identifier(column.column)} = ${canonical.id}
					where ${sql.identifier(column.column)} = ${asset.id} returning 1
				`);
				rewrittenForeignKeys += result.rows.length;
			}
			for (const column of jsonColumns) {
				const matches = await tx.execute<{ row_id: string; value: unknown }>(sql`
					select ctid::text as row_id, ${qualifiedColumn(column)} as value
					from ${qualifiedTable(column)}
					where ${qualifiedColumn(column)}::text like '%' || ${asset.key} || '%'
				`);
				for (const row of matches.rows) {
					const next = rewriteJsonValue(row.value, asset.key, canonical.key);
					if (next === row.value) {
						continue;
					}
					const cast = column.dataType === "json" ? sql`json` : sql`jsonb`;
					await tx.execute(sql`
						update ${qualifiedTable(column)}
						set ${sql.identifier(column.column)} = ${JSON.stringify(next)}::${cast}
						where ctid = ${row.row_id}::tid
					`);
					rewrittenJsonRows += 1;
				}
			}
		}
	});

	return {
		rewrittenForeignKeys,
		rewrittenJsonRows,
		mergedAssetIds: stale.map((asset) => asset.id),
	};
}
