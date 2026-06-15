import { TaggedError } from "better-result";

export class RateLimitError extends TaggedError("RateLimitError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
}>() {}
