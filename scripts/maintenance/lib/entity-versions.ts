/**
 * Grouping helper for the content-block backfills, which all have to answer the same question: a
 * document is named once (by slug, or by a WordPress post matching that slug), but its blocks live
 * on one `fields` row _per lifecycle version_.
 *
 * Scoping such a script to `entity_status = 'published'` looks right and is not: the CMS edit pages
 * call `ensureDraftVersion` and read the draft (`latestEditableEntityVersionWhere` prefers it), so
 * a fix applied only to the published version is invisible to editors — and is silently reverted
 * the next time anyone opens the item and saves, because the untouched draft publishes over it.
 * Worse, nothing flags the divergence: these scripts write to `content_blocks` and subtype tables
 * only, never to `entity_versions`, so `updated_at` does not move and `document_lifecycle.state`
 * still reads `published`.
 *
 * Writing to every version is therefore both the correct scope and safe — it cannot flip an item to
 * `published_with_changes`. This matches what the `data:backfill:institution-*` and
 * `data:normalise:*` scripts already do (see the readme).
 */

import type * as schema from "@dariah-eric/database/schema";

export type EntityStatusType = (typeof schema.entityStatusEnum)[number];

/** The columns a row must carry to be grouped: which version it came from, and its status. */
export interface EntityVersionRow {
	/** The `fields` row holding this version's content blocks — unique per version, so it is the key. */
	fieldId: string;
	/** `draft` or `published`, carried purely so logs and reports can name the version they touched. */
	status: EntityStatusType;
}

/**
 * Folds version-scoped rows into `documentKey -> one accumulator per version`.
 *
 * Callers key by whatever identifies the document on their side — `slug` where a script handles a
 * single entity type, `type/slug` where slugs are only unique per type. Versions are kept as a list
 * rather than merged, so per-version invariants (block positions, "does this field already have an
 * accordion", "does exactly one block use this image") are evaluated against one version's blocks
 * instead of both versions' blocks interleaved.
 */
export function groupByEntityVersion<Row extends EntityVersionRow, Value>(
	rows: Array<Row>,
	options: {
		documentKey: (row: Row) => string;
		create: (row: Row) => Value;
		add: (value: Value, row: Row) => void;
	},
): Map<string, Array<Value>> {
	const byDocument = new Map<string, Array<Value>>();
	const byField = new Map<string, Value>();

	for (const row of rows) {
		let value = byField.get(row.fieldId);

		if (value == null) {
			value = options.create(row);
			byField.set(row.fieldId, value);

			const key = options.documentKey(row);
			const versions = byDocument.get(key);
			if (versions == null) {
				byDocument.set(key, [value]);
			} else {
				versions.push(value);
			}
		}

		options.add(value, row);
	}

	return byDocument;
}
