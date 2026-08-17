import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestOptions, type RequestResult, request } from "@dariah-eric/request";
import { HttpError, type RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

/**
 * Retry transient failures (network errors, timeouts, 5xx and 429). Zotero is occasionally slow to
 * respond, and ingest sequentially paginates through many requests — a single hiccup should not
 * fail the whole run.
 */
const retry: RequestOptions["retry"] = {
	backoff: "exponential",
	delayMs: 1000,
	times: 3,
	shouldRetry(error) {
		if (error._tag === "NetworkError" || error._tag === "TimeoutError") {
			return true;
		}
		if (HttpError.is(error)) {
			return error.response.status >= 500 || error.response.status === 429;
		}
		return false;
	},
};

/**
 * CSL item types returned by Zotero's `format=csljson` responses.
 *
 * @see {@link https://www.zotero.org/support/dev/citation_styles/csl_0.8.1_syntax}
 */
export const zoteroCslItemTypes = [
	"article",
	"article-journal",
	"article-magazine",
	"article-newspaper",
	"bill",
	"book",
	"broadcast",
	"chapter",
	"classic",
	"collection",
	"dataset",
	"document",
	"entry",
	"entry-dictionary",
	"entry-encyclopedia",
	"event",
	"figure",
	"graphic",
	"hearing",
	"interview",
	"legal_case",
	"legislation",
	"manuscript",
	"map",
	"motion_picture",
	"musical_score",
	"pamphlet",
	"paper-conference",
	"patent",
	"performance",
	"periodical",
	"personal_communication",
	"post",
	"post-weblog",
	"regulation",
	"report",
	"review",
	"review-book",
	"software",
	"song",
	"speech",
	"standard",
	"thesis",
	"treaty",
	"webpage",
] as const;

export type ZoteroCslItemType = (typeof zoteroCslItemTypes)[number];

export interface ZoteroCslName {
	family?: string;
	given?: string;
	literal?: string;
	"non-dropping-particle"?: string;
	"dropping-particle"?: string;
	suffix?: string;
}

export interface ZoteroCslDate {
	"date-parts"?: [[number, number?, number?]];
	literal?: string;
	raw?: string;
}

export interface ZoteroCslItem {
	id: string;
	type: ZoteroCslItemType;
	abstract?: string;
	accessed?: ZoteroCslDate;
	author?: Array<ZoteroCslName>;
	"collection-title"?: string;
	"container-title"?: string;
	DOI?: string;
	edition?: string | number;
	editor?: Array<ZoteroCslName>;
	ISBN?: string;
	ISSN?: string;
	issue?: string | number;
	issued?: ZoteroCslDate;
	keyword?: string;
	language?: string;
	note?: string;
	page?: string;
	publisher?: string;
	"publisher-place"?: string;
	source?: string;
	title?: string;
	translator?: Array<ZoteroCslName>;
	URL?: string;
	version?: string;
	volume?: string | number;
}

export interface ZoteroCslJsonResponse {
	items: Array<ZoteroCslItem>;
}

export interface ZoteroJsonLibrary {
	type: string;
	id: number;
	name: string;
	links: Record<string, { href: string; type: string }>;
}

export type ZoteroJsonMeta = Record<string, unknown>;

export interface ZoteroJsonItem<TData extends Record<string, unknown> = Record<string, unknown>> {
	key: string;
	version: number;
	library: ZoteroJsonLibrary;
	links: Record<string, { href: string; type: string }>;
	meta: ZoteroJsonMeta;
	data: TData;
}

export interface ZoteroJsonItemsResponse<TItem extends ZoteroJsonItem = ZoteroJsonItem> {
	items: Array<TItem>;
}

export type ZoteroJsonItemsListResponse = Array<ZoteroJsonItem>;

export interface ZoteroCollectionData {
	key: string;
	version: number;
	name: string;
	parentCollection: string | false;
	relations: Record<string, unknown>;
}

export interface ZoteroCollection {
	key: string;
	version: number;
	library: {
		type: string;
		id: number;
		name: string;
		links: Record<string, { href: string; type: string }>;
	};
	links: Record<string, { href: string; type: string }>;
	meta: {
		numCollections: number;
		numItems: number;
	};
	data: ZoteroCollectionData;
}

export interface GetGroupItemsParams {
	groupId: string;
	limit?: number;
	start?: number;
}

export interface GetGroupCollectionsParams {
	groupId: string;
	limit?: number;
	start?: number;
}

export interface GetCollectionItemsParams {
	collectionId: string;
	groupId: string;
	limit?: number;
	start?: number;
}

export interface CreateZoteroClientParams {
	config: {
		apiKey?: string;
		baseUrl: string;
	};
}

const pageSize = 100;

/**
 * All known Zotero item types, kept here for documentation and to derive {@link ZoteroItemType}. The
 * actual API filter is built from {@link excludedZoteroItemTypes} so newly-introduced types are
 * ingested by default.
 *
 * @see {@link https://www.zotero.org/support/dev/web_api/v3/types_and_fields}
 * @see {@link https://api.zotero.org/itemTypes}
 */
export const zoteroItemTypes = [
	"annotation",
	"artwork",
	"attachment",
	"audioRecording",
	"bill",
	"blogPost",
	"book",
	"bookSection",
	"case",
	"computerProgram",
	"conferencePaper",
	"dataset",
	"dictionaryEntry",
	"document",
	"email",
	"encyclopediaArticle",
	"film",
	"forumPost",
	"hearing",
	"instantMessage",
	"interview",
	"journalArticle",
	"letter",
	"magazineArticle",
	"manuscript",
	"map",
	"newspaperArticle",
	"note",
	"patent",
	"podcast",
	"preprint",
	"presentation",
	"radioBroadcast",
	"report",
	"standard",
	"statute",
	"thesis",
	"tvBroadcast",
	"videoRecording",
	"webpage",
] as const;

/**
 * Zotero item types excluded from ingest.
 *
 * Note: the Zotero API accepts a single negation (e.g. `itemType=-note`) but rejects multiple
 * negations combined with any operator (`-note || -attachment`, `-note && -attachment`, comma-
 * separated, etc. — empirically all return 400 Bad Request as of 2026-05). When this list has more
 * than one entry, {@link buildZoteroItemTypeFilter} falls back to enumerating the included types
 * positively.
 */
export const excludedZoteroItemTypes = ["note"] as const satisfies ReadonlyArray<
	(typeof zoteroItemTypes)[number]
>;

export type ZoteroItemType = Exclude<
	(typeof zoteroItemTypes)[number],
	(typeof excludedZoteroItemTypes)[number]
>;

/**
 * Build the `itemType` filter expression from {@link excludedZoteroItemTypes}. The Zotero API
 * accepts a single negation (`-note`) but rejects multiple negations combined with any operator
 * (`-note || -attachment`, `-note && -attachment`, etc. all return 400). For more than one
 * exclusion we therefore enumerate the included types instead.
 *
 * @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#searching}
 */
function buildZoteroItemTypeFilter(): string {
	if (excludedZoteroItemTypes.length === 1) {
		return `-${excludedZoteroItemTypes[0]}`;
	}
	const excluded = new Set<string>(excludedZoteroItemTypes);
	return zoteroItemTypes.filter((type) => !excluded.has(type)).join(" || ");
}

const zoteroItemType = buildZoteroItemTypeFilter();

function createListAll<TItem, TResponse, TBaseParams extends object>(
	getPage: (
		params: TBaseParams & { limit: number; start: number },
	) => Promise<RequestResult<TResponse>>,
	getItems: (response: TResponse) => Array<TItem>,
): (params: TBaseParams) => Promise<Result<Array<TItem>, RequestError>> {
	return (params) =>
		Result.gen(async function* () {
			const items: Array<TItem> = [];
			let start = 0;
			let totalResults;

			do {
				const pageParams: TBaseParams & { limit: number; start: number } = {
					...params,
					limit: pageSize,
					start,
				};
				const { data, headers } = yield* Result.await(getPage(pageParams));
				items.push(...getItems(data));
				totalResults = Number(headers.get("Total-Results"));
				start += pageSize;
			} while (start < totalResults);

			return Result.ok(items);
		});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createZoteroClient(params: CreateZoteroClientParams) {
	const { apiKey, baseUrl } = params.config;

	const headers = {
		...(apiKey != null ? { "Zotero-API-Key": apiKey } : undefined),
		"Zotero-API-Version": "3",
	};

	/** @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#read_requests} */
	function getGroupItemsJson(
		params: GetGroupItemsParams,
	): Promise<RequestResult<Array<ZoteroJsonItem>>> {
		const { groupId, limit, start } = params;

		return request<Array<ZoteroJsonItem>>(
			createUrl({
				baseUrl,
				pathname: `/groups/${groupId}/items`,
				searchParams: createUrlSearchParams({
					itemType: zoteroItemType,
					limit,
					start,
				}),
			}),
			{ headers, responseType: "json", retry, timeout: 30_000 },
		);
	}

	/** @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#read_requests} */
	function getGroupItemsCslJson(
		params: GetGroupItemsParams,
	): Promise<RequestResult<ZoteroCslJsonResponse>> {
		const { groupId, limit, start } = params;

		return request<ZoteroCslJsonResponse>(
			createUrl({
				baseUrl,
				pathname: `/groups/${groupId}/items`,
				searchParams: createUrlSearchParams({
					format: "csljson",
					itemType: zoteroItemType,
					limit,
					start,
				}),
			}),
			{ headers, responseType: "json", retry, timeout: 30_000 },
		);
	}

	/** @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#read_requests} */
	function getGroupCollections(
		params: GetGroupCollectionsParams,
	): Promise<RequestResult<Array<ZoteroCollection>>> {
		const { groupId, limit, start } = params;

		return request<Array<ZoteroCollection>>(
			createUrl({
				baseUrl,
				pathname: `/groups/${groupId}/collections`,
				searchParams: createUrlSearchParams({ limit, start }),
			}),
			{ headers, responseType: "json", retry, timeout: 30_000 },
		);
	}

	/** @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#read_requests} */
	function getCollectionItemsJson(
		params: GetCollectionItemsParams,
	): Promise<RequestResult<Array<ZoteroJsonItem>>> {
		const { collectionId, groupId, limit, start } = params;

		return request<Array<ZoteroJsonItem>>(
			createUrl({
				baseUrl,
				pathname: `/groups/${groupId}/collections/${collectionId}/items`,
				searchParams: createUrlSearchParams({
					itemType: zoteroItemType,
					limit,
					start,
				}),
			}),
			{ headers, responseType: "json", retry, timeout: 30_000 },
		);
	}

	/** @see {@link https://www.zotero.org/support/dev/web_api/v3/basics#read_requests} */
	function getCollectionItemsCslJson(
		params: GetCollectionItemsParams,
	): Promise<RequestResult<ZoteroCslJsonResponse>> {
		const { collectionId, groupId, limit, start } = params;

		return request<ZoteroCslJsonResponse>(
			createUrl({
				baseUrl,
				pathname: `/groups/${groupId}/collections/${collectionId}/items`,
				searchParams: createUrlSearchParams({
					format: "csljson",
					itemType: zoteroItemType,
					limit,
					start,
				}),
			}),
			{ headers, responseType: "json", retry, timeout: 30_000 },
		);
	}

	return {
		items: {
			list(params: GetGroupItemsParams): Promise<RequestResult<Array<ZoteroJsonItem>>> {
				return getGroupItemsJson(params);
			},

			listAll(
				params: Omit<GetGroupItemsParams, "limit" | "start">,
			): Promise<Result<Array<ZoteroJsonItem>, RequestError>> {
				return createListAll(getGroupItemsJson, (response) => response)(params);
			},

			csljson: {
				list(params: GetGroupItemsParams): Promise<RequestResult<ZoteroCslJsonResponse>> {
					return getGroupItemsCslJson(params);
				},

				listAll(
					params: Omit<GetGroupItemsParams, "limit" | "start">,
				): Promise<Result<Array<ZoteroCslItem>, RequestError>> {
					return createListAll(getGroupItemsCslJson, (response) => response.items)(params);
				},
			},
		},

		collections: {
			list(params: GetGroupCollectionsParams): Promise<RequestResult<Array<ZoteroCollection>>> {
				return getGroupCollections(params);
			},

			listAll(
				params: Omit<GetGroupCollectionsParams, "limit" | "start">,
			): Promise<Result<Array<ZoteroCollection>, RequestError>> {
				return createListAll(getGroupCollections, (response) => response)(params);
			},

			items: {
				list(params: GetCollectionItemsParams): Promise<RequestResult<Array<ZoteroJsonItem>>> {
					return getCollectionItemsJson(params);
				},

				listAll(
					params: Omit<GetCollectionItemsParams, "limit" | "start">,
				): Promise<Result<Array<ZoteroJsonItem>, RequestError>> {
					return createListAll(getCollectionItemsJson, (response) => response)(params);
				},

				csljson: {
					list(params: GetCollectionItemsParams): Promise<RequestResult<ZoteroCslJsonResponse>> {
						return getCollectionItemsCslJson(params);
					},

					listAll(
						params: Omit<GetCollectionItemsParams, "limit" | "start">,
					): Promise<Result<Array<ZoteroCslItem>, RequestError>> {
						return createListAll(getCollectionItemsCslJson, (response) => response.items)(params);
					},
				},
			},
		},
	};
}

export type ZoteroClient = ReturnType<typeof createZoteroClient>;
