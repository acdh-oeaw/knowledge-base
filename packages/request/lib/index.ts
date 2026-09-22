import { Result } from "better-result";
import isNetworkError from "is-network-error";

import {
	AbortError,
	HttpError,
	NetworkError,
	ParseError,
	type RequestError,
	TimeoutError,
	UnknownError,
} from "./errors";

export type HttpMethod = "delete" | "get" | "head" | "options" | "patch" | "post" | "put" | "trace";

export type RequestBody = RequestInit["body"] | JsonValue | null;

export interface ResponseData<TJsonData = unknown> {
	arrayBuffer: ArrayBuffer;
	blob: Blob;
	bytes: Uint8Array<ArrayBuffer>;
	formData: FormData;
	json: TJsonData;
	response: Response;
	stream: ReadableStream<Uint8Array<ArrayBuffer>> | null;
	text: string;
	void: null;
}

export type ResponseType = keyof ResponseData;

/** @see {@link https://github.com/oven-sh/bun/issues/23741#issuecomment-3410060027} */
type OriginalFetch = typeof globalThis.fetch extends (...args: infer A) => infer R
	? (...args: A) => R
	: never;

export interface RequestOptions<TResponseType extends ResponseType = ResponseType> extends Omit<
	RequestInit,
	"body" | "method"
> {
	body?: RequestBody;
	fetch?: OriginalFetch;
	/** @default "get" */
	method?: HttpMethod;
	responseType: TResponseType;
	retry?: {
		backoff: "linear" | "constant" | "exponential";
		delayMs: number;
		shouldRetry?: (error: RequestError) => boolean;
		times: number;
	};
	/** @default 10_000 */
	timeout?: number | false;
}

export interface RequestInfo<TData = unknown> {
	data: TData;
	headers: Headers;
}

export type RequestResult<TData = unknown> = Result<RequestInfo<TData>, RequestError>;

export async function request<TJsonData, TResponseType extends "json" = "json">(
	url: URL | string,
	options: RequestOptions<TResponseType>,
): Promise<RequestResult<ResponseData<TJsonData>[TResponseType]>>;

export async function request<TResponseType extends ResponseType>(
	url: URL | string,
	options: RequestOptions<TResponseType>,
): Promise<RequestResult<ResponseData[TResponseType]>>;

export async function request<TResponseType extends ResponseType>(
	url: URL | string,
	options: RequestOptions<TResponseType>,
): Promise<RequestResult<ResponseData[TResponseType]>> {
	const {
		body: _body,
		headers: _headers,
		fetch = globalThis.fetch,
		method: _method,
		responseType,
		retry,
		signal: _signal,
		timeout = 10_000,
		...rest
	} = options;

	const method = _method?.toUpperCase();

	const headers = new Headers(_headers);

	if (!headers.has("accept")) {
		if (responseType === "json") {
			headers.set("accept", "application/json");
		} else if (responseType === "text") {
			headers.set("accept", "text/plain");
		} else {
			headers.set("accept", "*/*");
		}
	}

	let body: RequestInit["body"] = null;

	if (_body !== undefined) {
		if (isJsonBody(_body)) {
			body = JSON.stringify(_body);

			if (!headers.has("content-type")) {
				headers.set("content-type", "application/json");
			}
		} else {
			body = _body;
		}
	}

	function createRequest(): Request {
		const timeoutSignal = timeout !== false ? AbortSignal.timeout(timeout) : null;
		const signal =
			_signal && timeoutSignal
				? AbortSignal.any([_signal, timeoutSignal])
				: (_signal ?? timeoutSignal);

		return new Request(String(url), { ...rest, body, headers, method, signal });
	}

	/**
	 * The first attempt constructs eagerly, so an invalid url or method still fails fast. Every later
	 * attempt needs its own `Request`, because a request body can only be read once: retrying with
	 * the already-dispatched request makes `fetch` throw. The timeout is per attempt for the same
	 * reason - its `AbortSignal` is part of the request.
	 */
	let request = createRequest();

	/**
	 * Reading a response body can fail for reasons unrelated to the request itself: the connection
	 * dropped mid-stream, a multipart body is malformed, the payload is too large to allocate. They
	 * all mean the same thing - the response arrived but could not be decoded - which is exactly what
	 * `ParseError` describes.
	 */
	async function readBody<TData>(response: Response, read: () => Promise<TData>): Promise<TData> {
		try {
			return await read();
		} catch (error) {
			throw new ParseError({ cause: error, request, response });
		}
	}

	/**
	 * Only a `ReadableStream` body cannot be sent twice - every other `BodyInit` is read afresh when
	 * the next `Request` is constructed from it. Retrying a streamed body therefore throws while
	 * building the retry, which would replace the real failure (the 500, the timeout) with a
	 * confusing one about a disturbed body, so such a request is not retried at all.
	 */
	const isReplayable = !(body instanceof ReadableStream);

	const retryConfig =
		retry != null && isReplayable
			? { ...retry, shouldRetry: retry.shouldRetry ?? isRetryableByDefault }
			: undefined;

	return Result.tryPromise(
		{
			async try({ attempt }) {
				if (attempt > 1) {
					request = createRequest();
				}

				const response = await fetch(request);

				if (!response.ok) {
					throw new HttpError({ request, response });
				}

				if (method === "HEAD") {
					const data = null;
					return { data, headers: response.headers };
				}

				switch (responseType) {
					case "arrayBuffer": {
						const data = await readBody(response, () => response.arrayBuffer());
						return { data, headers: response.headers };
					}

					case "blob": {
						const data = await readBody(response, () => response.blob());
						return { data, headers: response.headers };
					}

					case "bytes": {
						const data = await readBody(response, () => response.bytes());
						return { data, headers: response.headers };
					}

					case "formData": {
						const data = await readBody(response, () =>
							// eslint-disable-next-line @typescript-eslint/no-deprecated
							response.formData(),
						);
						return { data, headers: response.headers };
					}

					case "json": {
						if (response.status === 204 || response.headers.get("content-length") === "0") {
							await discardBody(response);
							const data = null;
							return { data, headers: response.headers };
						}

						const data = await readBody(response, () => response.json());
						// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
						return { data: data as any, headers: response.headers };
					}

					case "response": {
						const data = response;
						return { data, headers: response.headers };
					}

					case "stream": {
						const data = response.body;
						return { data, headers: response.headers };
					}

					case "text": {
						const data = await readBody(response, () => response.text());
						return { data, headers: response.headers };
					}

					case "void": {
						await discardBody(response);
						const data = null;
						return { data, headers: response.headers };
					}
				}
			},
			catch(cause) {
				if (Error.isError(cause)) {
					if (HttpError.is(cause)) {
						return cause;
					}

					if (ParseError.is(cause)) {
						return cause;
					}

					if (cause.name === "AbortError") {
						return new AbortError({ cause, request });
					}

					if (cause.name === "TimeoutError") {
						return new TimeoutError({ cause, request });
					}

					if (isNetworkError(cause)) {
						return new NetworkError({ cause, request });
					}
				}

				return new UnknownError({ cause, request });
			},
		},
		{
			retry: retryConfig,
		},
	);
}

/**
 * Release the body of a response whose content we discard, so its connection can go back to the
 * pool instead of being held open by an unread body. This is cleanup, not part of the result: a
 * body that is already disturbed or locked has nothing left to release, so a failure here says
 * nothing about whether the request succeeded and must not be reported as if it did.
 */
async function discardBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// Already released - which is the outcome we wanted anyway.
	}
}

/**
 * The failures that surface as {@link UnknownError} are misuse or malformed input - an invalid url,
 * a body that cannot be read - rather than transient faults, so repeating them just wastes the
 * attempt budget. Everything else stays retryable, matching `better-result`'s own default.
 */
function isRetryableByDefault(error: RequestError): boolean {
	return !UnknownError.is(error);
}

type JsonPrimitive = string | number | boolean | null | undefined;
type JsonValue = JsonPrimitive | Array<JsonValue> | { [key: string]: JsonValue };

function isJsonBody(body: unknown): body is JsonValue {
	if (body === null) {
		return true;
	}

	if (typeof body !== "object") {
		return false;
	}

	if (
		body instanceof ArrayBuffer ||
		body instanceof Blob ||
		body instanceof FormData ||
		body instanceof ReadableStream ||
		body instanceof URLSearchParams
	) {
		return false;
	}

	return true;
}
