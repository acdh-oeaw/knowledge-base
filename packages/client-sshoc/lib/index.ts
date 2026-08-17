import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import { type RequestOptions, type RequestResult, request } from "@dariah-eric/request";
import { HttpError, type RequestError } from "@dariah-eric/request/errors";
import { Result } from "better-result";

/**
 * Retry transient failures (network errors, timeouts, 5xx and 429). The SSH Open Marketplace API is
 * occasionally slow; sequential pagination during ingest amplifies the chance of a transient
 * failure killing a whole run.
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

export type ItemCategory =
	| "tool-or-service"
	| "training-material"
	| "publication"
	| "dataset"
	| "workflow"
	| "step";

export type ItemStatus =
	| "draft"
	| "ingested"
	| "suggested"
	| "approved"
	| "disapproved"
	| "deprecated";

export type ItemFacet = "activity" | "keyword" | "language";

/**
 * Dynamic expression filter fields for the `d.` query param prefix.
 *
 * Standard index fields defined in `SearchFilter.ITEMS_INDEX_TYPE_PROPERTIES`:
 *
 * @see {@link https://github.com/sshoc/sshoc-marketplace-backend/blob/master/src/main/java/eu/sshopencloud/marketplace/services/search/filter/SearchFilter.java}
 *
 * Dynamic property type codes defined in `property-type-data.yml`:
 * @see {@link https://github.com/sshoc/sshoc-marketplace-backend/blob/master/src/main/resources/initial-data/property-type-data.yml}
 */
export type ItemDynamicField =
	/** Standard index fields. */
	| "status"
	| "owner"
	| "source"
	| "contributor"
	| "external-identifier"
	/** Access. */
	| "license"
	| "terms-of-use-url"
	| "terms-of-use"
	| "access-policy-url"
	| "geographical-availability"
	| "privacy-policy-url"
	| "authentication"
	/** Bibliographic. */
	| "publication-type"
	| "publisher"
	| "publication-place"
	| "year"
	| "journal"
	| "conference"
	| "volume"
	| "issue"
	| "pages"
	/** Categorisation. */
	| "activity"
	| "keyword"
	| "discipline"
	| "language"
	| "tool-family"
	| "mode-of-use"
	| "object-format"
	| "extent"
	| "intended-audience"
	| "standard"
	| "resource-category"
	/** Context. */
	| "see-also"
	| "user-manual-url"
	| "helpdesk-url"
	| "service-level-url"
	/** Curation (hidden). */
	| "processed-at"
	| "deprecated-at-source"
	| "curation-detail"
	| "curation-flag-url"
	| "conflict-at-source"
	| "curation-flag-description"
	| "curation-flag-coverage"
	| "curation-flag-relations"
	/** Technical. */
	| "life-cycle-status"
	| "technology-readiness-level"
	| "version"
	/** General. */
	| "source-last-update";

export type ItemSearchOrder = "score" | "label" | "modified-on";

export type PropertyValueType = "concept" | "string" | "url" | "int" | "float" | "date" | "boolean";

export interface VocabularyBasicDto {
	code: string;
	scheme: string;
	namespace: string;
	label: string;
	accessibleAt?: string;
	closed: boolean;
}

export interface ConceptBasicDto {
	code: string;
	vocabulary: VocabularyBasicDto;
	label: string;
	notation: string;
	definition?: string;
	uri: string;
	candidate: boolean;
}

export interface PropertyTypeDto {
	code: string;
	label: string;
	type: PropertyValueType;
	groupName: string;
	hidden: boolean;
	ord: number;
	allowedVocabularies: Array<VocabularyBasicDto>;
}

export type PropertyDto =
	| { type: PropertyTypeDto & { type: "concept" }; concept: ConceptBasicDto; value?: never }
	| {
			type: PropertyTypeDto & { type: Exclude<PropertyValueType, "concept"> };
			value: string;
			concept?: never;
	  };

export interface ActorRoleDto {
	code: string;
	label: string;
	ord: number;
}

export interface ActorSourceDto {
	code: string;
	label: string;
	ord: number;
	urlTemplate: string;
}

export interface ActorExternalIdDto {
	identifierService: ActorSourceDto;
	identifier: string;
}

export interface ItemBasicDto {
	id?: number;
	category?: ItemCategory;
	label?: string;
	version?: string;
	persistentId?: string;
	lastInfoUpdate?: string;
}

export interface ActorDto {
	id: number;
	name: string;
	externalIds: Array<ActorExternalIdDto>;
	website?: string;
	email?: string;
	affiliations: Array<ActorDto>;
	items?: Array<ItemBasicDto>;
}

export interface ItemContributorDto {
	actor: ActorDto;
	role: ActorRoleDto;
}

export interface SearchItem {
	id: number;
	persistentId: string;
	category: ItemCategory;
	label: string;
	version?: string;
	lastInfoUpdate: string;
	description: string;
	contributors: Array<ItemContributorDto>;
	properties: Array<PropertyDto>;
	status: ItemStatus;
	owner: string;
	accessibleAt?: Array<string>;
	thumbnailId?: string;
}

export function isSoftware(item: SearchItem): boolean {
	return item.properties.some(
		(property) =>
			property.type.code === "resource-category" &&
			property.concept?.vocabulary.code === "eosc-resource-category" &&
			property.concept.code === "category-sharing_and_discovery-software",
	);
}

export function isCoreService(item: SearchItem): boolean {
	return item.properties.some(
		(property) =>
			property.type.code === "keyword" &&
			property.concept?.vocabulary.code === "sshoc-keyword" &&
			property.concept.code === "dariahCoreService",
	);
}

export interface LabeledCheckedCount {
	count: number;
	checked: boolean;
	label: string;
}

export interface CheckedCount {
	count: number;
	checked: boolean;
}

type ItemFacetParams = { [K in ItemFacet as `f.${K}`]?: Array<string> };
type ItemDynamicParams = { [K in ItemDynamicField as `d.${K}`]?: Array<string> };

export interface ItemSearchParams extends ItemFacetParams, ItemDynamicParams {
	q?: string;
	categories?: Array<ItemCategory>;
	order?: Array<ItemSearchOrder>;
	page?: number;
	perpage?: number;
	advanced?: boolean;
	includeSteps?: boolean;
}

export interface ItemSearchResponse {
	hits: number;
	count: number;
	page: number;
	perpage: number;
	pages: number;
	q?: string;
	order: Array<ItemSearchOrder>;
	items: Array<SearchItem>;
	categories: Record<ItemCategory, LabeledCheckedCount>;
	facets: Record<ItemFacet, Record<string, CheckedCount>>;
}

export interface CreateSshocClientParams {
	config: {
		baseUrl: string;
		password?: string;
		user?: string;
	};
}

const perpage = 50;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSshocClient(params: CreateSshocClientParams) {
	const { baseUrl } = params.config;

	function searchItems(params: ItemSearchParams): Promise<RequestResult<ItemSearchResponse>> {
		const { q, categories, order, page, perpage, advanced, includeSteps, ...prefixedParams } =
			params;

		return request<ItemSearchResponse>(
			createUrl({
				baseUrl,
				pathname: "/api/item-search",
				searchParams: createUrlSearchParams({
					q,
					categories,
					order,
					page,
					perpage,
					advanced,
					includeSteps,
					...prefixedParams,
				}),
			}),
			{ responseType: "json", retry, timeout: 30_000 },
		);
	}

	return {
		items: {
			search(params: ItemSearchParams = {}): Promise<RequestResult<ItemSearchResponse>> {
				return searchItems(params);
			},

			searchAll(
				params: Omit<ItemSearchParams, "page" | "perpage"> = {},
			): Promise<Result<Array<SearchItem>, RequestError>> {
				return Result.gen(async function* () {
					const items: Array<SearchItem> = [];
					let page = 1;
					let totalPages;

					do {
						const { data } = yield* Result.await(searchItems({ ...params, page, perpage }));
						items.push(...data.items);
						totalPages = data.pages;
						page++;
					} while (page <= totalPages);

					return Result.ok(items);
				});
			},
		},
	};
}

export type SshocClient = ReturnType<typeof createSshocClient>;
