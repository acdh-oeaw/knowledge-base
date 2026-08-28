import {
	AbortError,
	HttpError,
	NetworkError,
	ParseError,
	TimeoutError,
} from "@dariah-eric/request/errors";

/**
 * A structured description of why a background job failed. Persisted as jsonb in the
 * `background_jobs.error` column so the admin dashboard can render a localized message instead of a
 * raw stack trace. The most common failures are request errors against the external APIs we sync
 * from; `unknown` is the fallback for everything else (and for legacy rows that predate this
 * shape).
 */
export type BackgroundJobError =
	| { kind: "http"; host: string; status: number; statusText: string }
	| { kind: "timeout"; host: string }
	| { kind: "network"; host: string }
	| { kind: "parse"; host: string }
	| { kind: "abort"; host: string }
	| { kind: "stuck" }
	| { kind: "unknown"; message: string };

/** The host of a request URL, falling back to the raw URL if it cannot be parsed. */
function getRequestHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

/** Reduce a thrown background-job error to a structured {@link BackgroundJobError}. */
export function toBackgroundJobError(error: unknown): BackgroundJobError {
	if (HttpError.is(error)) {
		const { status, statusText } = error.response;
		return { kind: "http", host: getRequestHost(error.request.url), status, statusText };
	}
	if (TimeoutError.is(error)) {
		return { kind: "timeout", host: getRequestHost(error.request.url) };
	}
	if (NetworkError.is(error)) {
		return { kind: "network", host: getRequestHost(error.request.url) };
	}
	if (ParseError.is(error)) {
		return { kind: "parse", host: getRequestHost(error.request.url) };
	}
	if (AbortError.is(error)) {
		return { kind: "abort", host: getRequestHost(error.request.url) };
	}
	// oxlint-disable-next-line unicorn/no-instanceof-builtins
	if (error instanceof Error) {
		return { kind: "unknown", message: error.message.length > 0 ? error.message : error.name };
	}
	if (typeof error === "string") {
		return { kind: "unknown", message: error };
	}
	return { kind: "unknown", message: JSON.stringify(error) };
}

/**
 * Coerce a persisted `background_jobs.error` value (jsonb, so already deserialized) into a
 * {@link BackgroundJobError}. Anything that does not match the expected shape — e.g. a legacy raw
 * string that slipped through — is surfaced as an `unknown` error.
 */
export function coerceBackgroundJobError(value: unknown): BackgroundJobError {
	if (value != null && typeof value === "object" && "kind" in value) {
		return value as BackgroundJobError;
	}
	if (typeof value === "string") {
		return { kind: "unknown", message: value };
	}
	return { kind: "unknown", message: JSON.stringify(value) };
}
