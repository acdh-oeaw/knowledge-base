import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@dariah-eric/request";
import type { RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

export interface ZenodoLink {
	href: string;
	type?: string;
	title?: string;
}

export interface ZenodoRecordCreator {
	name: string;
	affiliation?: string | null;
	orcid?: string;
}

export interface ZenodoRecordResourceType {
	title: string;
	type: string;
	subtype?: string;
}

export interface ZenodoRecordCommunity {
	id: string;
}

export interface ZenodoRecordFile {
	id: string;
	key: string;
	size: number;
	checksum: string;
	links: {
		self: string;
	};
}

export interface ZenodoRecordMetadata {
	title: string;
	description?: string;
	creators: Array<ZenodoRecordCreator>;
	communities?: Array<ZenodoRecordCommunity>;
	keywords?: Array<string>;
	keyword?: Array<string>;
	language?: string;
	notes?: string;
	access_right?: string;
	published?: string | null;
	publication_date?: string | null;
	resource_type?: ZenodoRecordResourceType;
	version?: string;
	[metadataField: string]: unknown;
}

export interface ZenodoRecord {
	id: number;
	conceptrecid?: string;
	created?: string | null;
	doi?: string;
	files?: Array<ZenodoRecordFile>;
	links: Record<string, string | Record<string, string>>;
	metadata: ZenodoRecordMetadata;
	modified?: string | null;
	record_id?: number;
	state?: string;
	submitted?: boolean;
	owners?: Array<{ id: string }>;
	recid?: string;
	revision?: number;
	swh?: Record<string, unknown> | null;
	updated?: string;
	stats?: Record<string, number>;
	title: string;
	[recordField: string]: unknown;
}

export interface ZenodoRecordsHits {
	total: number;
	hits: Array<ZenodoRecord>;
}

export interface ZenodoRecordsResponse {
	hits: ZenodoRecordsHits;
	aggregations?: Record<string, unknown>;
	links?: Record<string, string>;
}

export type ZenodoRecordSort = "bestmatch" | "mostrecent" | "-bestmatch" | "-mostrecent";

export type ZenodoRecordStatus = "draft" | "published";

export interface GetZenodoRecordsParams {
	q?: string;
	status?: ZenodoRecordStatus;
	sort?: ZenodoRecordSort;
	page?: number;
	size?: number;
	allVersions?: boolean;
	communities?: string;
	type?: string;
	subtype?: string;
	bounds?: string;
	custom?: string;
}

export interface GetZenodoRecordParams {
	id: number | string;
}

export interface CreateZenodoClientParams {
	baseUrl: string;
	communityId?: string;
	apiKey?: string;
}

const defaultCommunityId = "dariah";

/**
 * Zenodo caps the page size at 25 for unauthenticated requests and allows up to 100 for
 * authenticated ones.
 *
 * @see {@link https://developers.zenodo.org/#rate-limiting}
 */
const anonymousPageSize = 25;
const authenticatedPageSize = 100;

/**
 * Zenodo records search and community filtering:
 *
 * @see {@link https://developers.zenodo.org/}
 * @see {@link https://zenodo.org/communities/dariah}
 */
function createListAll<TParams extends object>(
	getPage: (
		params: TParams & { page: number; size: number },
	) => Promise<RequestResult<ZenodoRecordsResponse>>,
	pageSize: number,
): (params: TParams) => Promise<Result<Array<ZenodoRecord>, RequestError>> {
	return (params) =>
		Result.gen(async function* () {
			const items: Array<ZenodoRecord> = [];
			let page = 1;
			let totalItems = Infinity;

			// Zenodo returns a wrapper object with total hits and the current page of records,
			// so we keep paging until we have consumed the reported total.
			while (items.length < totalItems) {
				const { data } = yield* Result.await(getPage({ ...params, page, size: pageSize }));
				items.push(...data.hits.hits);
				totalItems = data.hits.total;

				if (data.hits.hits.length === 0) {
					break;
				}

				page += 1;
			}

			return Result.ok(items);
		});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createZenodoClient(params: CreateZenodoClientParams) {
	const { baseUrl, communityId = defaultCommunityId, apiKey } = params;

	const pageSize = apiKey != null ? authenticatedPageSize : anonymousPageSize;

	const headers = apiKey != null ? { authorization: `Bearer ${apiKey}` } : undefined;

	/** @see {@link https://developers.zenodo.org/} */
	function listRecords(
		params: GetZenodoRecordsParams = {},
	): Promise<RequestResult<ZenodoRecordsResponse>> {
		const { communities, ...searchParams } = params;

		return request<ZenodoRecordsResponse>(
			createUrl({
				baseUrl,
				pathname: "/api/records",
				searchParams: createUrlSearchParams({
					...searchParams,
					communities: communities ?? communityId,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	/** @see {@link https://developers.zenodo.org/} */
	function getRecord(params: GetZenodoRecordParams): Promise<RequestResult<ZenodoRecord>> {
		const { id } = params;

		return request<ZenodoRecord>(
			createUrl({
				baseUrl,
				pathname: `/api/records/${String(id)}`,
			}),
			{ headers, responseType: "json" },
		);
	}

	return {
		records: {
			get(params: GetZenodoRecordParams): Promise<RequestResult<ZenodoRecord>> {
				return getRecord(params);
			},

			list(params: GetZenodoRecordsParams = {}): Promise<RequestResult<ZenodoRecordsResponse>> {
				return listRecords(params);
			},

			listAll(
				params: Omit<GetZenodoRecordsParams, "page" | "size"> = {},
			): Promise<Result<Array<ZenodoRecord>, RequestError>> {
				return createListAll((pageParams) => listRecords(pageParams), pageSize)(params);
			},
		},
	};
}

export type ZenodoClient = ReturnType<typeof createZenodoClient>;
