import { TaggedError } from "better-result";

export class EmailConnectionError extends TaggedError("EmailConnectionError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
}>() {}

export class EmailSendError extends TaggedError("EmailSendError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
}>() {}
