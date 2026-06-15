import { TaggedError } from "better-result";

export class DatabaseConnectionError extends TaggedError("DatabaseConnectionError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
}>() {}

export class DatabaseError extends TaggedError("DatabaseError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
}>() {}
