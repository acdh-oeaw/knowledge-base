import { TaggedError } from "better-result";

export class InvalidUserIdError extends TaggedError("InvalidUserIdError")<{
	readonly cause?: unknown;
	readonly id: string;
	readonly message?: string;
}>() {}
