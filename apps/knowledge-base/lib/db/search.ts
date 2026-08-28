import { type SQL, type SQLWrapper, and, or, sql } from "@/lib/db/sql";

export function unaccentIlike(value: SQLWrapper, pattern: string): SQL<boolean> {
	return sql`unaccent(${value}) ILIKE unaccent(${pattern})`;
}

/**
 * Normalize a searchable column so a tokenized query can match it regardless of punctuation or
 * "&"/"and" spelling: map "&" to " and ", strip accents, lowercase, and collapse every run of
 * non-alphanumeric characters to a single space. This lets "Culture, Innovation" match a stored
 * "Culture Innovation" (and vice versa), and "R&D" match "R and D". The query terms are normalized
 * with the same rules in {@link normalizeSearchTerms}, so both sides stay in sync.
 *
 * Like {@link unaccentIlike}, the resulting expression is not sargable (the wrapped column can't use
 * a b-tree index), which is fine for the small, scan-friendly lookup-picker queries this powers.
 */
export function normalizedSearchColumn(value: SQLWrapper): SQL<string> {
	return sql`regexp_replace(lower(unaccent(replace(${value}, '&', ' and '))), '[^a-z0-9]+', ' ', 'g')`;
}

/**
 * Whether the normalized {@link value} contains {@link term} as a substring. {@link term} is expected
 * to already be normalized (see {@link normalizeSearchTerms}), so it holds only lowercase
 * alphanumerics and spaces — no LIKE metacharacters to escape.
 */
export function normalizedIncludes(value: SQLWrapper, term: string): SQL<boolean> {
	return sql`${normalizedSearchColumn(value)} LIKE ${`%${term}%`}`;
}

/**
 * Split a raw query into normalized search terms, mirroring {@link normalizedSearchColumn}: strip
 * accents, lowercase, and split on any run of non-alphanumeric characters (so commas, hyphens,
 * ampersands, and slashes all act as separators). Empty terms are dropped.
 */
export function normalizeSearchTerms(query: string): Array<string> {
	return query
		.normalize("NFKD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((term) => term !== "");
}

/**
 * Build a tokenized, punctuation-insensitive `WHERE` predicate: split {@link query} into terms and
 * require every term to match at least one of the given {@link columns} (AND across terms, OR across
 * columns). Matching is via {@link normalizedIncludes}, so separators and "&"/"and" differences
 * between the query and the stored value don't matter, and term order is irrelevant.
 *
 * Returns `undefined` when the query is empty (or all punctuation), so callers can drop it straight
 * into an `and(...)` where an absent search means "no filter".
 */
export function matchesAllTerms(
	query: string | null | undefined,
	...columns: [SQLWrapper, ...Array<SQLWrapper>]
): SQL | undefined {
	const terms = query != null ? normalizeSearchTerms(query) : [];
	if (terms.length === 0) {
		return undefined;
	}
	return and(
		...terms.map((term) => or(...columns.map((column) => normalizedIncludes(column, term)))),
	);
}
