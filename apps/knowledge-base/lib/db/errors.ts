/** Postgres `exclusion_violation` — raised when a GiST exclusion constraint rejects a row. */
const EXCLUSION_VIOLATION = "23P01";
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

export type UserFacingDatabaseError =
	| "entity-slug-conflict"
	| "invalid-data"
	| "missing-data"
	| "missing-related-record"
	| "record-conflict"
	| "unique-conflict";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value != null;
}

/**
 * Detects whether `error` is a Postgres exclusion-constraint violation for the given constraint.
 *
 * Relation tables (persons-to-units, units-to-units) use a GiST exclusion constraint to allow the
 * same (source, target, role) triple to recur over non-overlapping durations while rejecting
 * overlapping ones. Rather than mirror that rule in the server action, we let the database be the
 * single source of truth and translate the resulting error into a user-facing message.
 *
 * Walks the `cause` chain since drizzle may wrap the underlying driver error.
 */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && isObject(current); depth++) {
		if (current.code === EXCLUSION_VIOLATION && current.constraint === constraint) {
			return true;
		}
		current = current.cause;
	}
	return false;
}

/**
 * Detects whether `error` is a Postgres unique-constraint violation for the given constraint.
 *
 * The counterpart to `isExclusionViolation`, for callers that recover from a specific collision
 * rather than reporting it — above all slug derivation, which retries under a new candidate. Match
 * on the constraint name so an unrelated unique violation still propagates.
 *
 * Walks the `cause` chain since drizzle may wrap the underlying driver error.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && isObject(current); depth++) {
		if (current.code === UNIQUE_VIOLATION && current.constraint === constraint) {
			return true;
		}
		current = current.cause;
	}
	return false;
}

/**
 * Classifies database integrity errors that callers can safely explain to users.
 *
 * PostgreSQL's structured error fields are stable and do not expose query details. Drizzle may wrap
 * the driver error, so inspect the cause chain rather than matching error-message text.
 */
export function getUserFacingDatabaseError(error: unknown): UserFacingDatabaseError | null {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && isObject(current); depth++) {
		if (
			current.code === UNIQUE_VIOLATION &&
			current.constraint === "slugs_published_type_locale_value_unique"
		) {
			return "entity-slug-conflict";
		}

		switch (current.code) {
			case UNIQUE_VIOLATION: {
				return "unique-conflict";
			}
			case FOREIGN_KEY_VIOLATION: {
				return "missing-related-record";
			}
			case EXCLUSION_VIOLATION: {
				return "record-conflict";
			}
			case CHECK_VIOLATION: {
				return "invalid-data";
			}
			case NOT_NULL_VIOLATION: {
				return "missing-data";
			}
		}

		current = current.cause;
	}

	return null;
}
