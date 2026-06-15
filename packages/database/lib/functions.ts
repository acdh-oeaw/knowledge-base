import { type SQL, type SQLWrapper, sql } from "drizzle-orm";

export function lower(value: SQLWrapper): SQL<string | null> {
	return sql`LOWER(${value})`;
}

export function now(): SQL<Date> {
	return sql`NOW()`;
}

export function uuidv7(): SQL<string> {
	return sql`UUIDV7()`;
}
