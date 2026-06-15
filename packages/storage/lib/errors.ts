import { TaggedError } from "better-result";

export class StorageUploadError extends TaggedError("StorageUploadError")<{
	readonly cause?: unknown;
	readonly message?: string;
}>() {}

export class StorageDownloadError extends TaggedError("StorageDownloadError")<{
	readonly cause?: unknown;
	readonly message?: string;
}>() {}

export class StorageDeleteError extends TaggedError("StorageDeleteError")<{
	readonly cause?: unknown;
	readonly message?: string;
}>() {}

export class StorageBucketError extends TaggedError("StorageBucketError")<{
	readonly cause?: unknown;
	readonly message?: string;
}>() {}
