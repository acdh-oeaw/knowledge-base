import { type SQL, sql } from "drizzle-orm";

import type { Database, Transaction } from "./index";

/**
 * Shared foreign-key discovery for the cleanup services. The set of columns referencing a table is
 * read from the Postgres catalog rather than hard-coded, so a new reference to (say) `assets` or
 * `social_media` is picked up automatically and never causes a still-referenced row to be pruned.
 */

export interface CatalogColumn {
	schema: string;
	table: string;
	column: string;
}

export function qualifiedColumn(column: CatalogColumn): SQL {
	return sql`${sql.identifier(column.schema)}.${sql.identifier(column.table)}.${sql.identifier(column.column)}`;
}

export function qualifiedTable(column: CatalogColumn): SQL {
	return sql`${sql.identifier(column.schema)}.${sql.identifier(column.table)}`;
}

/** Columns holding a foreign key that references `<referencedTable>.id`. */
async function getForeignKeyColumns(
	db: Database | Transaction,
	referencedTable: string,
): Promise<Array<CatalogColumn>> {
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
		where c.confrelid = to_regclass(${referencedTable}) and c.contype = 'f'
	`);

	return result.rows.map((row) => {
		return { schema: row.schema_name, table: row.table_name, column: row.column_name };
	});
}

/** The set of `<referencedTable>.id` values referenced by any foreign key anywhere in the database. */
export async function getReferencedIds(
	db: Database | Transaction,
	referencedTable: string,
): Promise<Set<string>> {
	const columns = await getForeignKeyColumns(db, referencedTable);

	if (columns.length === 0) {
		return new Set();
	}

	const selects = columns.map(
		(column) =>
			sql`select ${qualifiedColumn(column)}::text as id from ${qualifiedTable(column)} where ${qualifiedColumn(column)} is not null`,
	);

	const result = await db.execute<{ id: string }>(sql.join(selects, sql` union `));

	return new Set(result.rows.map((row) => row.id));
}
