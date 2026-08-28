import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@dariah-eric/request";
import type { RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

export interface HalResponseHeader {
	status?: number;
	QTime?: number;
	params?: Record<string, string>;
}

export interface HalSearchResponse<TDocument extends HalDocument = HalDocument> {
	responseHeader?: HalResponseHeader;
	response: {
		numFound: number;
		start: number;
		docs: Array<TDocument>;
	};
	nextCursorMark?: string;
}

export interface HalDocument {
	docid: string | number;
	[key: string]: unknown;
}

export type HalDocumentSort = "docid asc" | "docid desc" | (string & {});

export interface GetHalDocumentsParams {
	q?: string;
	fq?: Array<string> | string;
	fl?: Array<string> | string;
	sort?: HalDocumentSort;
	rows?: number;
	start?: number;
	cursorMark?: string;
}

export interface CreateHalClientParams {
	baseUrl: string;
	collectionCode?: string;
}

const defaultCollectionCode = "DARIAH";
const pageSize = 100;
const defaultSort = "docid asc";

/**
 * HAL search API and DARIAH collection source references:
 *
 * @see {@link https://api.archives-ouvertes.fr/docs/search}
 * @see {@link https://hal.science/DARIAH}
 */
function normalizeSearchParams(
	params: GetHalDocumentsParams,
	defaults?: { cursorMark?: string },
): Record<string, string | number | boolean | Array<string>> {
	const {
		q = "*:*",
		fq,
		fl = "*",
		sort = defaultSort,
		rows = pageSize,
		start,
		cursorMark,
	} = params;
	const searchParams: Record<string, string | number | boolean | Array<string>> = {
		q,
		fl,
		sort,
		rows,
		wt: "json",
		indent: true,
	};

	if (fq != null) {
		searchParams.fq = fq;
	}

	if (start != null) {
		searchParams.start = start;
	}

	const resolvedCursorMark = cursorMark ?? defaults?.cursorMark;
	if (resolvedCursorMark != null) {
		searchParams.cursorMark = resolvedCursorMark;
	}

	return searchParams;
}

function createListAll<TParams extends object, TItem extends HalDocument>(
	getPage: (
		params: TParams & { cursorMark?: string; rows: number; sort?: HalDocumentSort },
	) => Promise<RequestResult<HalSearchResponse<TItem>>>,
): (params: TParams & { sort?: HalDocumentSort }) => Promise<Result<Array<TItem>, RequestError>> {
	return (params) =>
		Result.gen(async function* () {
			const items: Array<TItem> = [];
			let cursorMark = "*";

			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			while (true) {
				const { data } = yield* Result.await(
					getPage({ ...params, cursorMark, rows: pageSize, sort: params.sort ?? defaultSort }),
				);
				items.push(...data.response.docs);

				if (data.nextCursorMark == null || data.nextCursorMark === cursorMark) {
					break;
				}

				cursorMark = data.nextCursorMark;
			}

			return Result.ok(items);
		});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createHalClient(params: CreateHalClientParams) {
	const { baseUrl, collectionCode = defaultCollectionCode } = params;

	/** @see {@link https://api.archives-ouvertes.fr/docs/search} */
	function listDocuments(
		params: GetHalDocumentsParams = {},
	): Promise<RequestResult<HalSearchResponse>> {
		return request<HalSearchResponse>(
			createUrl({
				baseUrl,
				pathname: `/search/${collectionCode}`,
				searchParams: createUrlSearchParams(normalizeSearchParams(params)),
			}),
			{ responseType: "json" },
		);
	}

	return {
		documents: {
			list(params: GetHalDocumentsParams = {}): Promise<RequestResult<HalSearchResponse>> {
				return listDocuments(params);
			},

			listAll(
				params: Omit<GetHalDocumentsParams, "cursorMark" | "rows" | "start"> & {
					sort?: HalDocumentSort;
				} = {},
			): Promise<Result<Array<HalDocument>, RequestError>> {
				return createListAll((pageParams) => listDocuments(pageParams))(params);
			},
		},
	};
}

export type HalClient = ReturnType<typeof createHalClient>;
