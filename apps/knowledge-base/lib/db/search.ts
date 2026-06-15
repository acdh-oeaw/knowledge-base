import { type SQL, type SQLWrapper, sql } from "@/lib/db/sql";

export function unaccentIlike(value: SQLWrapper, pattern: string): SQL<boolean> {
	return sql`unaccent(${value}) ILIKE unaccent(${pattern})`;
}
