import { eq, sql } from "drizzle-orm";

import { type CatalogColumn, getReferencedIds, qualifiedTable } from "./cleanup-references";
import type { Database, Transaction } from "./index";
import * as schema from "./schema";

/**
 * Detects assets which are not referenced anywhere, so they can be safely pruned from the database
 * and object storage, and removes them. Shared by the `@dariah-eric/maintenance` cli scripts and
 * the admin dashboard, so both use the exact same definition of "unused".
 *
 * Assets are referenced in two ways, both of which this check accounts for:
 *
 * 1. **By id**, through foreign keys pointing at `assets.id` (e.g. `news.image_id`,
 *    `persons.image_id`, content blocks, …). The referencing columns are discovered from the
 *    Postgres catalog rather than hard-coded, so new foreign keys are picked up automatically.
 * 2. **By key**, embedded inside rich-text (tiptap) content — the `assetImage` node stores the asset's
 *    `key` (not its id) as `imageKey`. Rich text lives in `jsonb` columns, so every `jsonb` column
 *    is scanned for the candidate's key.
 *
 * The check is deliberately **conservative**: an asset counts as used if a reference is found by
 * _either_ mechanism, and the key scan matches the key as a substring anywhere in a `jsonb` column.
 * The bias is always toward keeping an asset — a missed reference would only retain an asset that
 * could have been deleted, never delete one that is still in use.
 */

export interface UnusedAsset {
	id: string;
	key: string;
	label: string;
	/** File size in bytes, or `null` for assets uploaded before size tracking was added. */
	size: number | null;
	mimeType: string;
}

export interface UnusedAssetsResult {
	assets: Array<UnusedAsset>;
	/** Sum of the (known) sizes of the unused assets, in bytes. */
	totalSize: number;
}

/**
 * All `jsonb` columns in user schemas, which is where rich-text (and thus embedded asset keys)
 * live.
 */
async function getJsonbColumns(db: Database | Transaction): Promise<Array<CatalogColumn>> {
	const result = await db.execute<{
		table_schema: string;
		table_name: string;
		column_name: string;
	}>(sql`
		select table_schema, table_name, column_name
		from information_schema.columns
		where table_schema not in ('pg_catalog', 'information_schema')
			and data_type in ('jsonb', 'json')
	`);

	return result.rows.map((row) => {
		return { schema: row.table_schema, table: row.table_name, column: row.column_name };
	});
}

/**
 * Of the given asset keys, the subset whose key appears anywhere in a rich-text (`jsonb`) column.
 * Runs one query per `jsonb` column; each restricts to the candidate keys, so the scanned surface
 * shrinks as candidates are eliminated.
 */
async function getKeysEmbeddedInRichText(
	db: Database | Transaction,
	candidateKeys: Array<string>,
): Promise<Set<string>> {
	const used = new Set<string>();

	if (candidateKeys.length === 0) {
		return used;
	}

	const columns = await getJsonbColumns(db);

	for (const column of columns) {
		const remaining = candidateKeys.filter((key) => !used.has(key));
		if (remaining.length === 0) {
			break;
		}

		// A scalar `VALUES` list (each key its own parameter) rather than an array parameter — drizzle
		// expands an array in a template into a tuple `($1, $2, …)`, which cannot be cast to `text[]`.
		const keyValues = sql.join(
			remaining.map((key) => sql`(${key})`),
			sql`, `,
		);

		const result = await db.execute<{ key: string }>(sql`
			select distinct a.key
			from (values ${keyValues}) as a(key)
			where exists (
				select 1 from ${qualifiedTable(column)} as t
				where t.${sql.identifier(column.column)}::text like '%' || a.key || '%'
			)
		`);

		for (const row of result.rows) {
			used.add(row.key);
		}
	}

	return used;
}

export async function findUnusedAssets(db: Database | Transaction): Promise<UnusedAssetsResult> {
	const referencedIds = await getReferencedIds(db, "assets");

	const allAssets = await db.execute<{
		id: string;
		key: string;
		label: string;
		size: string | null;
		mime_type: string;
	}>(sql`select id::text, key, label, size, mime_type from assets`);

	const candidates = allAssets.rows.filter((asset) => !referencedIds.has(asset.id));

	const embeddedKeys = await getKeysEmbeddedInRichText(
		db,
		candidates.map((asset) => asset.key),
	);

	const unused = candidates
		.filter((asset) => !embeddedKeys.has(asset.key))
		.map((asset): UnusedAsset => {
			return {
				id: asset.id,
				key: asset.key,
				label: asset.label,
				size: asset.size != null ? Number(asset.size) : null,
				mimeType: asset.mime_type,
			};
		});

	const totalSize = unused.reduce((sum, asset) => sum + (asset.size ?? 0), 0);

	return { assets: unused, totalSize };
}

export interface DeleteUnusedAssetsOptions {
	/**
	 * Removes the asset's object from storage. Throwing aborts that asset's deletion (its database
	 * row is left intact) and reports it as failed. Kept as a callback so this module does not depend
	 * on `@dariah-eric/storage` — the caller passes its own storage service.
	 */
	deleteObject: (key: string) => Promise<void>;
	/** Recorded as the actor of the `delete` audit events; `null` for system/cli runs. */
	actorUserId?: string | null;
	/**
	 * Runs for each asset immediately before its object is deleted, e.g. to back it up. Throwing
	 * aborts that asset's deletion (so a failed backup never loses data) and reports it as failed.
	 */
	onBeforeDelete?: (asset: UnusedAsset) => Promise<void>;
}

export interface DeleteUnusedAssetsResult {
	/** Number of assets removed from both storage and the database. */
	deletedCount: number;
	/** Total size (bytes) reclaimed from the deleted assets. */
	reclaimedSize: number;
	/**
	 * Ids which were requested but not deleted because they are no longer unused (a reference was
	 * added since they were listed) or no longer exist.
	 */
	skippedIds: Array<string>;
	/** Ids whose backup or storage deletion failed; their database rows were left intact. */
	failedIds: Array<string>;
}

/**
 * Prunes the given assets from object storage and the database. Only assets which are _still_
 * unused at call time are deleted — the unused set is recomputed here rather than trusting the
 * caller's ids, so a reference added in the meantime protects the asset. Object storage is not
 * transactional, so each asset's object is removed first and its database row (plus a `delete`
 * audit event) only after; a backup or storage failure leaves the row intact and is reported.
 */
export async function deleteUnusedAssets(
	db: Database | Transaction,
	ids: Array<string>,
	options: DeleteUnusedAssetsOptions,
): Promise<DeleteUnusedAssetsResult> {
	const { deleteObject, actorUserId = null, onBeforeDelete } = options;

	const requested = new Set(ids);
	const { assets: unused } = await findUnusedAssets(db);
	const deletable = unused.filter((asset) => requested.has(asset.id));
	const deletableIds = new Set(deletable.map((asset) => asset.id));
	const skippedIds = ids.filter((id) => !deletableIds.has(id));

	const failedIds: Array<string> = [];
	let deletedCount = 0;
	let reclaimedSize = 0;

	for (const asset of deletable) {
		try {
			await onBeforeDelete?.(asset);
			await deleteObject(asset.key);
		} catch {
			failedIds.push(asset.id);
			continue;
		}

		await db.transaction(async (tx) => {
			await tx.delete(schema.assets).where(eq(schema.assets.id, asset.id));
			await tx.insert(schema.auditLogs).values({
				action: "delete",
				actorUserId,
				subjectType: "asset",
				subjectId: asset.id,
				summary: { key: asset.key, label: asset.label, size: asset.size },
			});
		});

		deletedCount += 1;
		reclaimedSize += asset.size ?? 0;
	}

	return { deletedCount, reclaimedSize, skippedIds, failedIds };
}
