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
	width: number | null;
	height: number | null;
	contentHash: string;
	createdAt: string;
}

export interface DuplicateAsset extends DuplicateAssetCandidate {
	foreignKeyReferences: number;
	jsonReferences: number;
}

export interface DuplicateAssetGroup {
	fingerprint: string;
	assets: Array<DuplicateAsset>;
}

export interface DuplicateAssetsResult {
	groups: Array<DuplicateAssetGroup>;
	/** Images without a recorded content hash, which cannot be compared until they are backfilled. */
	unhashedImages: number;
}

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

interface ReferenceCounts {
	foreignKeyReferences: Map<string, number>;
	jsonReferences: Map<string, number>;
}

/** Counts references for all assets at once: one query per column rather than per asset and column. */
async function countReferences(
	db: Database | Transaction,
	assets: Array<DuplicateAssetCandidate>,
	foreignKeys: Array<CatalogColumn>,
	jsonColumns: Array<JsonColumn>,
): Promise<ReferenceCounts> {
	const foreignKeyReferences = new Map<string, number>();
	const jsonReferences = new Map<string, number>();
	if (assets.length === 0) {
		return { foreignKeyReferences, jsonReferences };
	}

	// Scalar `VALUES` lists rather than array parameters — drizzle expands an array in a template
	// into a tuple `($1, $2, …)`, which cannot be cast to an array type.
	const idValues = sql.join(
		assets.map((asset) => sql`(${asset.id})`),
		sql`, `,
	);
	for (const column of foreignKeys) {
		const result = await db.execute<{ id: string; count: string }>(sql`
			select ${qualifiedColumn(column)}::text as id, count(*)::text as count
			from ${qualifiedTable(column)}
			where ${qualifiedColumn(column)} in (select a.id::uuid from (values ${idValues}) as a(id))
			group by 1
		`);
		for (const row of result.rows) {
			foreignKeyReferences.set(row.id, (foreignKeyReferences.get(row.id) ?? 0) + Number(row.count));
		}
	}

	const keyValues = sql.join(
		assets.map((asset) => sql`(${asset.key})`),
		sql`, `,
	);
	for (const column of jsonColumns) {
		const result = await db.execute<{ value: unknown }>(sql`
			select t.${sql.identifier(column.column)} as value from ${qualifiedTable(column)} as t
			where exists (
				select 1 from (values ${keyValues}) as a(key)
				where t.${sql.identifier(column.column)}::text like '%' || a.key || '%'
			)
		`);
		for (const row of result.rows) {
			for (const asset of assets) {
				const count = countJsonValue(row.value, asset.key);
				if (count > 0) {
					jsonReferences.set(asset.key, (jsonReferences.get(asset.key) ?? 0) + count);
				}
			}
		}
	}

	return { foreignKeyReferences, jsonReferences };
}

/**
 * Groups images by their recorded `content_hash`. Identical digests mean identical bytes, so no
 * object has to be downloaded; images uploaded before hashes were tracked are only counted, until
 * `data:backfill:asset-content-hashes` has hashed them.
 */
export async function findDuplicateAssets(
	db: Database | Transaction,
	options: { ids?: Array<string>; label?: string } = {},
): Promise<DuplicateAssetsResult> {
	const labelFilter = options.label?.trim();
	const ids = options.ids;
	if (ids?.length === 0) {
		return { groups: [], unhashedImages: 0 };
	}
	const filters = sql`
		${labelFilter != null && labelFilter !== "" ? sql`and label ilike ${`%${labelFilter}%`}` : sql``}
		${
			ids != null
				? sql`and id::text in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})`
				: sql``
		}
	`;

	const result = await db.execute<{
		id: string;
		key: string;
		label: string;
		mime_type: string;
		size: string | null;
		width: number | null;
		height: number | null;
		content_hash: string;
		created_at: string;
	}>(sql`
		with candidates as (
			select id, key, label, mime_type, size, width, height, content_hash, created_at
			from assets
			where mime_type like 'image/%' and content_hash is not null ${filters}
		)
		select id::text, key, label, mime_type, size::text, width, height, content_hash,
			created_at::text
		from candidates
		where content_hash in (
			select content_hash from candidates group by content_hash having count(*) > 1
		)
		order by content_hash, created_at, id
	`);
	const unhashed = await db.execute<{ count: string }>(sql`
		select count(*)::text as count from assets
		where mime_type like 'image/%' and content_hash is null ${filters}
	`);

	const candidates = result.rows.map((row): DuplicateAssetCandidate => {
		return {
			id: row.id,
			key: row.key,
			label: row.label,
			mimeType: row.mime_type,
			size: Number(row.size ?? 0),
			width: row.width,
			height: row.height,
			contentHash: row.content_hash,
			createdAt: row.created_at,
		};
	});

	const foreignKeys = await getForeignKeyColumns(db, "assets");
	const jsonColumns = await getJsonColumns(db);
	const references = await countReferences(db, candidates, foreignKeys, jsonColumns);

	const groups = groupBy(candidates, (asset) => asset.contentHash).map((group) => {
		return {
			fingerprint: group[0]!.contentHash,
			assets: group.map((asset) => {
				return {
					...asset,
					foreignKeyReferences: references.foreignKeyReferences.get(asset.id) ?? 0,
					jsonReferences: references.jsonReferences.get(asset.key) ?? 0,
				};
			}),
		};
	});

	return { groups, unhashedImages: Number(unhashed.rows[0]?.count ?? 0) };
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
): Promise<MergeDuplicateAssetsResult> {
	const requested = new Set([canonicalId, ...staleIds]);
	const { groups } = await findDuplicateAssets(db, { ids: Array.from(requested) });
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
