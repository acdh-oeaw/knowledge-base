/** The disallowed operations a mutation can reject with a message that is safe to show the user. */
export type UserFacingErrorKind =
	| "document-linked-to-user"
	| "entity-slug-conflict"
	| "missing-dariah-eric"
	| "missing-paired-relation-unit"
	| "published-slug-rename"
	| "relation-end-before-start"
	| "relation-not-endable"
	| "relation-period-overlap"
	| "service-kpi-conflict"
	| "slug-too-long"
	| "social-media-kpi-conflict";

/**
 * A failure a mutation raises on purpose, having recognised a disallowed operation, so the action
 * wrapper can turn it into a specific message instead of a generic "internal server error".
 *
 * This is the deliberate counterpart to the database-error translation in `lib/db/errors.ts`: that
 * one _infers_ a safe message from a driver error code after the fact, whereas this is thrown by
 * code that already knows exactly what it refused and why.
 */
export class UserFacingError extends Error {
	readonly kind: UserFacingErrorKind;

	constructor(kind: UserFacingErrorKind) {
		super(kind);
		this.name = "UserFacingError";
		this.kind = kind;
	}
}

/**
 * Find a `UserFacingError` in `error` or its cause chain.
 *
 * Walks the chain because a transaction wrapper may re-wrap what a mutation threw, exactly as the
 * database-error detectors do.
 */
export function findUserFacingError(error: unknown): UserFacingError | null {
	let current: unknown = error;
	for (let depth = 0; depth < 5 && current != null; depth++) {
		if (current instanceof UserFacingError) {
			return current;
		}
		current = (current as { cause?: unknown }).cause;
	}
	return null;
}
