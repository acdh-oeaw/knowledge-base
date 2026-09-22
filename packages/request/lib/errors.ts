import { TaggedError } from "better-result";

export class AbortError extends TaggedError("AbortError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
}> {}

export class ParseError extends TaggedError("ParseError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
	readonly response: Response;
}> {}

export class HttpError extends TaggedError("HttpError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
	readonly response: Response;
}> {}

export class NetworkError extends TaggedError("NetworkError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
}> {}

export class TimeoutError extends TaggedError("TimeoutError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
}> {}

/**
 * A failure that maps to none of the errors above. The set is open-ended by nature - an invalid url
 * or method, a body that cannot be read on a non-json `responseType`, a `RangeError` allocating an
 * oversized `arrayBuffer`, whatever a caller-supplied `fetch` decides to throw, or a `TypeError`
 * from `fetch` whose message `is-network-error` does not recognise.
 *
 * It exists so the `catch` handler stays total: a handler that throws is a `Panic` in
 * `better-result`, which escapes the `Result` entirely and surfaces as an unhandled rejection.
 */
export class UnknownError extends TaggedError("UnknownError")<{
	readonly cause?: unknown;
	readonly message?: unknown;
	readonly request: Request;
}> {}

export type RequestError =
	| AbortError
	| ParseError
	| HttpError
	| NetworkError
	| TimeoutError
	| UnknownError;
