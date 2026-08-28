import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestResult, request } from "@dariah-eric/request";
import type { RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

export type EpisciencesLocalizedText = Record<string, string>;

export interface EpisciencesReviewSetting {
	"@type"?: "ReviewSetting";
	"@id"?: string;
	setting: string;
	value: string | null;
}

export interface EpisciencesJournal {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "Review";
	code: string;
	creation?: string;
	name: string;
	piwikid?: number;
	settings: Array<EpisciencesReviewSetting>;
	status?: number;
	rvid: number;
	subtitle: string | null;
}

export type EpisciencesAssignedSection = Record<string, unknown>;

export interface EpisciencesAffiliation {
	label?: string;
	rorId?: string;
}

export interface EpisciencesAdditionalProfileInformation {
	affiliations?: Array<EpisciencesAffiliation>;
	biography?: string;
	[key: string]: unknown;
}

export interface EpisciencesUser {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "User";
	additionalProfileInformation: EpisciencesAdditionalProfileInformation | null;
	assignedSections: Array<EpisciencesAssignedSection> | null;
	civ: string | null;
	email: string;
	firstname: string | null;
	langueid: string;
	lastname: string;
	middlename: string | null;
	orcid: string;
	picture: string | null;
	roles: Array<Array<string>>;
	screenName: string;
	uid: number;
	uuid: string;
}

export interface EpisciencesNewsItem {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "News";
	content: EpisciencesLocalizedText;
	creator: {
		"@id"?: string;
		"@type"?: "User";
		screenName?: string;
		[key: string]: unknown;
	};
	date_creation: string;
	date_updated: string;
	id: number;
	link: EpisciencesLocalizedText;
	rvcode: string;
	visibility?: Array<string>;
	title: EpisciencesLocalizedText;
}

export interface EpisciencesPage {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "Page";
	content: EpisciencesLocalizedText;
	date_creation: string | null;
	date_updated: string;
	id: number;
	page_code: string;
	rvcode: string;
	visibility?: Array<string>;
	title: EpisciencesLocalizedText;
}

export interface EpisciencesSearchDocument {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "SolrDoc";
	abstract_t?: Array<string>;
	author_fullname_s?: Array<string>;
	author_fullname_fs?: Array<string>;
	doi_s?: string;
	docid?: number;
	en_abstract_t?: string;
	en_paper_title_t?: string;
	en_volume_title_t?: string;
	es_doc_url_s?: string;
	es_pdf_url_s?: string;
	es_publication_date_tdate?: string;
	es_submission_date_tdate?: string;
	fr_abstract_t?: string;
	fr_paper_title_t?: string;
	fr_volume_title_t?: string;
	keyword_t?: Array<string>;
	indexing_date_tdate?: string;
	paperid?: number;
	language_s?: string;
	paper_title_t?: Array<string>;
	publication_date_tdate?: string;
	publication_date_day_fs?: string;
	publication_date_month_fs?: string;
	publication_date_year_fs?: string;
	revue_id_i?: number;
	revue_code_t?: string;
	revue_title_s?: string;
	type?: string | Array<string>;
	version_td?: number;
	volume_fs?: string;
	volume_id_i?: number;
	volume_status_i?: number;
	volume_title_t?: Array<string>;
}

/**
 * A relation to another work, e.g. the repository deposit (HAL, Zenodo, arXiv, ...) a paper
 * overlays. `@relationship-type` is typically `"isSameAs"` for the canonical deposit and
 * `"hasPreprint"` for additional/older versions; `@identifier-type` is `"doi"` or `"uri"`.
 */
export interface EpisciencesIntraWorkRelation {
	value: string;
	"@identifier-type"?: string;
	"@relationship-type"?: string;
}

export interface EpisciencesRelatedItem {
	intra_work_relation?: EpisciencesIntraWorkRelation | Array<EpisciencesIntraWorkRelation>;
}

export interface EpisciencesDoiData {
	doi?: string;
	resource?: string;
}

export interface EpisciencesJournalArticle {
	doi_data?: EpisciencesDoiData;
	program?:
		| { related_item?: EpisciencesRelatedItem | Array<EpisciencesRelatedItem> }
		| Array<{ related_item?: EpisciencesRelatedItem | Array<EpisciencesRelatedItem> }>;
	[key: string]: unknown;
}

/**
 * Full paper record returned by `/api/papers/{docid}`. The search endpoint only returns minimal
 * Solr documents (title, abstract, ids), so the journal DOI and the links to external repository
 * deposits are only available here, in the crossref-style deposit metadata.
 */
export interface EpisciencesPaper {
	"@context"?: string;
	"@id"?: string;
	"@type"?: "Paper";
	paperid?: number;
	document?: {
		journal?: {
			journal_article?: EpisciencesJournalArticle;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
}

export interface EpisciencesHydraCollection<TItem> {
	"hydra:totalItems": number;
	"hydra:member"?: Array<TItem>;
	"hydra:view"?: {
		"@id"?: string;
		"@type"?: string;
		"hydra:first"?: string;
		"hydra:last"?: string;
		"hydra:previous"?: string;
		"hydra:next"?: string;
	};
	"hydra:search"?: {
		"@type"?: string;
		"hydra:template"?: string;
		"hydra:variableRepresentation"?: string;
		"hydra:mapping"?: Array<Record<string, unknown>>;
	};
}

export interface GetEpisciencesJournalsParams {
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface GetEpisciencesBoardParams {
	code?: string;
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface GetEpisciencesSearchParams {
	terms?: string;
	code?: string;
	type?: string | Array<string>;
	volumeId?: number | Array<number>;
	sectionId?: number | Array<number>;
	year?: number | Array<number>;
	authorFullname?: string | Array<string>;
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface GetEpisciencesNewsParams {
	year?: number | Array<number>;
	code?: string;
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface GetEpisciencesPagesParams {
	code?: string;
	page?: number;
	itemsPerPage?: number;
	pagination?: boolean;
}

export interface CreateEpisciencesClientParams {
	config: {
		baseUrl: string;
		/** API bearer token. Required for secured journal endpoints. */
		token?: string;
		/**
		 * Default journal code used when callers do not pass one explicitly.
		 *
		 * @default "transformations"
		 */
		journalCode?: string;
	};
}

export const defaultEpisciencesJournalCode = "transformations";
const pageSize = 30;

function createHeaders(token?: string): RequestInit["headers"] | undefined {
	/**
	 * Api defaults to `application/ld+json`, but our request helper assumes `application/json` for
	 * `responseType: "json"`, which produces a different response shape.
	 */
	const headers = {
		accept: "application/ld+json",
	};

	if (token == null) {
		return headers;
	}

	return {
		...headers,
		authorization: `Bearer ${token}`,
	};
}

function createListAll<TParams extends object, TItem>(
	getPage: (
		params: TParams & { page: number; itemsPerPage: number },
	) => Promise<RequestResult<EpisciencesHydraCollection<TItem>>>,
): (params: TParams) => Promise<Result<Array<TItem>, RequestError>> {
	return (params) =>
		Result.gen(async function* () {
			const items: Array<TItem> = [];
			let page = 1;
			let totalItems = Infinity;

			while (items.length < totalItems) {
				const { data } = yield* Result.await(getPage({ ...params, page, itemsPerPage: pageSize }));
				const members = data["hydra:member"] ?? [];
				items.push(...members);
				totalItems = data["hydra:totalItems"];

				if (members.length === 0) {
					break;
				}

				page += 1;
			}

			return Result.ok(items);
		});
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createEpisciencesClient(params: CreateEpisciencesClientParams) {
	const { baseUrl, journalCode = defaultEpisciencesJournalCode, token } = params.config;
	const headers = createHeaders(token);
	/**
	 * The `/api/papers/{docid}` endpoint nests its crossref deposit metadata differently when served
	 * as `application/ld+json`, so request plain json for it to keep the response shape predictable.
	 */
	const jsonHeaders: RequestInit["headers"] =
		token != null
			? { accept: "application/json", authorization: `Bearer ${token}` }
			: { accept: "application/json" };

	function getPaper(docid: number | string): Promise<RequestResult<EpisciencesPaper>> {
		return request<EpisciencesPaper>(
			createUrl({
				baseUrl,
				pathname: `/api/papers/${String(docid)}`,
			}),
			{ headers: jsonHeaders, responseType: "json" },
		);
	}

	function getJournals(
		params: GetEpisciencesJournalsParams = {},
	): Promise<RequestResult<Array<EpisciencesJournal>>> {
		const { page, itemsPerPage, pagination } = params;

		return request<Array<EpisciencesJournal>>(
			createUrl({
				baseUrl,
				pathname: "/api/journals/",
				searchParams: createUrlSearchParams({
					page,
					itemsPerPage,
					pagination,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	function getJournal(code = journalCode): Promise<RequestResult<EpisciencesJournal>> {
		return request<EpisciencesJournal>(
			createUrl({
				baseUrl,
				pathname: `/api/journals/${code}`,
			}),
			{ headers, responseType: "json" },
		);
	}

	function getBoardMembers(
		params: GetEpisciencesBoardParams = {},
	): Promise<RequestResult<EpisciencesHydraCollection<EpisciencesUser>>> {
		const { code = journalCode, page, itemsPerPage, pagination } = params;

		return request<EpisciencesHydraCollection<EpisciencesUser>>(
			createUrl({
				baseUrl,
				pathname: `/api/journals/boards/${code}`,
				searchParams: createUrlSearchParams({
					page,
					itemsPerPage,
					pagination,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	function searchDocuments(
		params: GetEpisciencesSearchParams = {},
	): Promise<RequestResult<EpisciencesHydraCollection<EpisciencesSearchDocument>>> {
		const {
			terms = "*:*",
			code = journalCode,
			type,
			volumeId,
			sectionId,
			year,
			authorFullname,
			page,
			itemsPerPage,
			pagination,
		} = params;

		return request<EpisciencesHydraCollection<EpisciencesSearchDocument>>(
			createUrl({
				baseUrl,
				pathname: "/api/search/",
				searchParams: createUrlSearchParams({
					terms,
					rvcode: code,
					type,
					"type[]": Array.isArray(type) ? type : undefined,
					volume_id: Array.isArray(volumeId) ? undefined : volumeId,
					"volume_id[]": Array.isArray(volumeId) ? volumeId : undefined,
					section_id: Array.isArray(sectionId) ? undefined : sectionId,
					"section_id[]": Array.isArray(sectionId) ? sectionId : undefined,
					year: Array.isArray(year) ? undefined : year,
					"year[]": Array.isArray(year) ? year : undefined,
					author_fullname: Array.isArray(authorFullname) ? undefined : authorFullname,
					"author_fullname[]": Array.isArray(authorFullname) ? authorFullname : undefined,
					page,
					itemsPerPage,
					pagination,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	function getNews(
		params: GetEpisciencesNewsParams = {},
	): Promise<RequestResult<Array<EpisciencesNewsItem>>> {
		const { year, code = journalCode, page, itemsPerPage, pagination } = params;

		return request<Array<EpisciencesNewsItem>>(
			createUrl({
				baseUrl,
				pathname: "/api/news/",
				searchParams: createUrlSearchParams({
					year: Array.isArray(year) ? undefined : year,
					"year[]": Array.isArray(year) ? year : undefined,
					rvcode: code,
					page,
					itemsPerPage,
					pagination,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	function getNewsItem(id: string): Promise<RequestResult<EpisciencesNewsItem>> {
		return request<EpisciencesNewsItem>(
			createUrl({
				baseUrl,
				pathname: `/api/news/${id}`,
			}),
			{ headers, responseType: "json" },
		);
	}

	function getPages(
		params: GetEpisciencesPagesParams = {},
	): Promise<RequestResult<Array<EpisciencesPage>>> {
		const { code = journalCode, page, itemsPerPage, pagination } = params;

		return request<Array<EpisciencesPage>>(
			createUrl({
				baseUrl,
				pathname: "/api/pages",
				searchParams: createUrlSearchParams({
					rvcode: code,
					page,
					itemsPerPage,
					pagination,
				}),
			}),
			{ headers, responseType: "json" },
		);
	}

	function getAtomFeed(code = journalCode): Promise<RequestResult<string>> {
		return request(
			createUrl({
				baseUrl,
				pathname: `/api/feed/atom/${code}`,
			}),
			{ headers, responseType: "text" },
		);
	}

	function getRssFeed(code = journalCode): Promise<RequestResult<string>> {
		return request(
			createUrl({
				baseUrl,
				pathname: `/api/feed/rss/${code}`,
			}),
			{ headers, responseType: "text" },
		);
	}

	return {
		boards: {
			list(
				params: GetEpisciencesBoardParams = {},
			): Promise<RequestResult<EpisciencesHydraCollection<EpisciencesUser>>> {
				return getBoardMembers(params);
			},

			listAll(
				params: Omit<GetEpisciencesBoardParams, "page" | "itemsPerPage"> = {},
			): Promise<Result<Array<EpisciencesUser>, RequestError>> {
				return createListAll((pageParams) => getBoardMembers(pageParams))(params);
			},
		},

		feeds: {
			atom(code = journalCode): Promise<RequestResult<string>> {
				return getAtomFeed(code);
			},

			rss(code = journalCode): Promise<RequestResult<string>> {
				return getRssFeed(code);
			},
		},

		journals: {
			get(code?: string): Promise<RequestResult<EpisciencesJournal>> {
				return getJournal(code);
			},

			list(
				params: GetEpisciencesJournalsParams = {},
			): Promise<RequestResult<Array<EpisciencesJournal>>> {
				return getJournals(params);
			},

			listAll(
				params: GetEpisciencesJournalsParams = {},
			): Promise<Result<Array<EpisciencesJournal>, RequestError>> {
				return Result.gen(async function* () {
					const { data } = yield* Result.await(getJournals(params));
					return Result.ok(data);
				});
			},
		},

		news: {
			get(id: string): Promise<RequestResult<EpisciencesNewsItem>> {
				return getNewsItem(id);
			},

			list(
				params: GetEpisciencesNewsParams = {},
			): Promise<RequestResult<Array<EpisciencesNewsItem>>> {
				return getNews(params);
			},

			listAll(
				params: GetEpisciencesNewsParams = {},
			): Promise<Result<Array<EpisciencesNewsItem>, RequestError>> {
				return Result.gen(async function* () {
					const { data } = yield* Result.await(getNews(params));
					return Result.ok(data);
				});
			},
		},

		papers: {
			get(docid: number | string): Promise<RequestResult<EpisciencesPaper>> {
				return getPaper(docid);
			},
		},

		pages: {
			list(params: GetEpisciencesPagesParams = {}): Promise<RequestResult<Array<EpisciencesPage>>> {
				return getPages(params);
			},

			listAll(
				params: GetEpisciencesPagesParams = {},
			): Promise<Result<Array<EpisciencesPage>, RequestError>> {
				return Result.gen(async function* () {
					const { data } = yield* Result.await(getPages(params));
					return Result.ok(data);
				});
			},
		},

		search: {
			list(
				params: GetEpisciencesSearchParams = {},
			): Promise<RequestResult<EpisciencesHydraCollection<EpisciencesSearchDocument>>> {
				return searchDocuments(params);
			},

			listAll(
				params: Omit<GetEpisciencesSearchParams, "page" | "itemsPerPage"> = {},
			): Promise<Result<Array<EpisciencesSearchDocument>, RequestError>> {
				return createListAll((pageParams) => searchDocuments(pageParams))(params);
			},
		},
	};
}

export type EpisciencesClient = ReturnType<typeof createEpisciencesClient>;
