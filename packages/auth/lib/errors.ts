import { TaggedError } from "better-result";

export class InvalidUserIdError extends TaggedError("InvalidUserIdError")<{
	readonly cause?: unknown;
	readonly id: string;
	readonly message?: string;
}> {}

export type ImpersonationNotAllowedReason =
	| "already_impersonating"
	| "no_session"
	| "not_admin"
	| "self"
	| "target_is_admin"
	| "two_factor_required";

export class ImpersonationNotAllowedError extends TaggedError("ImpersonationNotAllowedError")<{
	readonly cause?: unknown;
	readonly message?: string;
	readonly reason: ImpersonationNotAllowedReason;
}> {}
