/** Postgres `exclusion_violation` — raised when a GiST exclusion constraint rejects a row. */
const EXCLUSION_VIOLATION = "23P01";

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
