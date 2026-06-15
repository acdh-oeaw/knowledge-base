import { Result, UnhandledException } from "better-result";
import isNetworkError from "is-network-error";

import {
	AbortError,
	HttpError,
	NetworkError,
	ParseError,
	type RequestError,
	TimeoutError,
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

	let body: RequestBody = null;

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

	const timeoutSignal = timeout !== false ? AbortSignal.timeout(timeout) : null;
	const signal =
		_signal && timeoutSignal
			? AbortSignal.any([_signal, timeoutSignal])
			: (_signal ?? timeoutSignal);

	const request = new Request(String(url), { ...rest, body, headers, method, signal });

	return Result.tryPromise(
		{
			async try() {
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
						const data = await response.arrayBuffer();
						return { data, headers: response.headers };
					}

					case "blob": {
						const data = await response.blob();
						return { data, headers: response.headers };
					}

					case "bytes": {
						const data = await response.bytes();
						return { data, headers: response.headers };
					}

					case "formData": {
						// eslint-disable-next-line @typescript-eslint/no-deprecated
						const data = await response.formData();
						return { data, headers: response.headers };
					}

					case "json": {
						if (response.status === 204 || response.headers.get("content-length") === "0") {
							await response.body?.cancel();
							const data = null;
							return { data, headers: response.headers };
						}

						try {
							const data = await response.json();
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
							return { data: data as any, headers: response.headers };
						} catch (error) {
							throw new ParseError({ cause: error, request, response });
						}
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
						const data = await response.text();
						return { data, headers: response.headers };
					}

					case "void": {
						await response.body?.cancel();
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

				throw new UnhandledException({ cause });
			},
		},
		{
			retry,
		},
	);
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
