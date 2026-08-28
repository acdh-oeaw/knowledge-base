import { db } from "@/lib/db";
import { sql } from "@/lib/db/sql";

export interface ExpensiveStatement {
	query: string;
	calls: number;
	/** Total time spent in the statement, in milliseconds. */
	totalExecTime: number;
	/** Mean time per call, in milliseconds. */
	meanExecTime: number;
	rows: number;
}

export interface ExpensiveStatementsResult {
	/** `false` when the `pg_stat_statements` extension/view is not available in this database. */
	available: boolean;
	data: Array<ExpensiveStatement>;
}

interface ExpensiveStatementRow {
	[column: string]: string | number;
	query: string;
	calls: string | number;
	total_exec_time: string | number;
	mean_exec_time: string | number;
	rows: string | number;
}

/**
 * Returns the most time-consuming statements recorded by `pg_stat_statements`, ordered by total
 * execution time. Degrades gracefully (`available: false`) when the extension is not installed — it
 * requires `shared_preload_libraries=pg_stat_statements` in `postgresql.conf`, which cannot be
 * enabled from SQL alone.
 */
export async function getExpensiveStatements(limit = 20): Promise<ExpensiveStatementsResult> {
	try {
		const result = await db.execute<ExpensiveStatementRow>(
			sql`
				SELECT query, calls, total_exec_time, mean_exec_time, rows
				FROM pg_stat_statements
				WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
				ORDER BY total_exec_time DESC
				LIMIT ${limit}
			`,
		);

		const data = result.rows.map((row) => {
			return {
				query: row.query,
				calls: Number(row.calls),
				totalExecTime: Number(row.total_exec_time),
				meanExecTime: Number(row.mean_exec_time),
				rows: Number(row.rows),
			};
		});

		return { available: true, data };
	} catch {
		// The view either does not exist (extension not installed) or raises on read because the module
		// is not loaded via `shared_preload_libraries`. Both cases mean stats are unavailable.
		return { available: false, data: [] };
	}
}
