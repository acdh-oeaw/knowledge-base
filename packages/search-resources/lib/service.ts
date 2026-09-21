import { log } from "@acdh-oeaw/lib";
import type { DariahCampusClient } from "@dariah-eric/client-campus";
import type { SshocClient } from "@dariah-eric/client-sshoc";
import type { ZenodoClient } from "@dariah-eric/client-zenodo";
import {
	type ResourceDocument,
	type SearchService,
	type WebsiteDocument,
	resourceSources,
} from "@dariah-eric/search";
import type { SearchAdminService } from "@dariah-eric/search/admin";
import { Result } from "better-result";

import {
	type OrgUnitResourceLookups,
	type SearchIndexResourceSourceData,
	createSearchIndexResourceDocuments,
	createWebsiteResourceDocuments,
} from "./resources";

export interface SearchResourcesCache<CacheError = unknown> {
	getOrFetch<T, FetchError>(
		key: string,
		fetcher: () => Promise<Result<T, FetchError>>,
	): Promise<Result<T, FetchError | CacheError>>;
}

export interface CreateSearchResourcesServiceParams {
	campus: DariahCampusClient;
	search: SearchAdminService;
	searchService: SearchService;
	sshoc: SshocClient;
	sshocMarketplaceBaseUrl: string;
	zenodo: ZenodoClient;
	/**
	 * Lookups used to resolve sshoc actor ids and zotero collection names to the slugs of national
	 * consortia and working groups that own a resource.
	 */
	orgUnits: OrgUnitResourceLookups;
	/**
	 * DARIAH-Campus has no server-side filter for this, so it is applied client-side after `listAll`
	 * fetches every page (see `ListAllDariahCampusResourcesParams`). Unset ingests campus resources
	 * from every national consortium, matching every other source in this service.
	 */
	campusNationalConsortiumCode?: string;
}

export interface FetchSearchResourcesParams {
	cache?: SearchResourcesCache;
}

export interface SyncSearchResourcesResult {
	count: number;
	/**
	 * Stale documents that could not be removed from the index. Ingest failures are not counted here
	 * — those throw and fail the whole job. A non-zero count means content that no longer exists
	 * stays findable in search until the next successful run.
	 */
	failedCount: number;
	/** The ids behind {@link SyncSearchResourcesResult.failedCount}. */
	failedDeletions: Array<StaleDocumentDeletion>;
	websiteCount: number;
}

/** A stale search document that could not be deleted. */
export interface StaleDocumentDeletion {
	collection: string;
	documentId: string;
}

function getOrFetch<T, FetchError, CacheError>(
	cache: SearchResourcesCache<CacheError> | undefined,
	key: string,
	fetcher: () => Promise<Result<T, FetchError>>,
): Promise<Result<T, FetchError | CacheError>> {
	if (cache == null) {
		return fetcher();
	}

	return cache.getOrFetch(key, fetcher);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSearchResourcesService(params: CreateSearchResourcesServiceParams) {
	const {
		campus,
		search,
		searchService,
		sshoc,
		sshocMarketplaceBaseUrl,
		zenodo,
		orgUnits,
		campusNationalConsortiumCode,
	} = params;

	const externalSourcesFilter = `source:[${resourceSources.join(",")}]`;

	async function fetchSearchIndexResourceSourceData(
		options?: FetchSearchResourcesParams,
	): Promise<SearchIndexResourceSourceData> {
		const cache = options?.cache;

		const result = await Result.gen(async function* () {
			const [sshocItemsResult, campusResourcesResult, campusCurriculaResult, zenodoRecordsResult] =
				await Promise.all([
					getOrFetch(cache, "sshoc/items", () =>
						sshoc.items.searchAll({
							"f.keyword": ["DARIAH Resource"],
							categories: ["tool-or-service", "training-material", "workflow"],
							order: ["label"],
						}),
					),
					getOrFetch(cache, "campus/resources", () =>
						campus.resources.listAll({ nationalConsortiumCode: campusNationalConsortiumCode }),
					),
					getOrFetch(cache, "campus/curricula", () =>
						campus.curricula.listAll({ nationalConsortiumCode: campusNationalConsortiumCode }),
					),
					getOrFetch(cache, "zenodo/records", () => zenodo.records.listAll()),
				]);

			const sshocItems = yield* sshocItemsResult;
			const campusResources = yield* campusResourcesResult;
			const campusCurricula = yield* campusCurriculaResult;
			const zenodoRecords = yield* zenodoRecordsResult;

			/**
			 * Depends on the search documents above (needs their doc ids), so it cannot run in the
			 * parallel batch and is fetched afterwards.
			 */

			return Result.ok({
				campusCurricula,
				campusResources,
				sshocItems,
				zenodoRecords,
			});
		});

		return result.unwrap();
	}

	function createResourceDocuments(sourceData: SearchIndexResourceSourceData) {
		return createSearchIndexResourceDocuments({
			sourceData,
			sshocMarketplaceBaseUrl,
			orgUnits,
		});
	}

	async function getExistingResourceDocumentIds(): Promise<Set<string>> {
		const documentIds = new Set<string>();
		let page = 1;
		let totalPages;

		do {
			const result = await searchService.collections.resources.search({
				filterBy: externalSourcesFilter,
				page,
				perPage: 250,
				query: "*",
			});

			if (result.isErr()) {
				throw result.error;
			}

			for (const item of result.value.items) {
				documentIds.add(item.document.id);
			}

			totalPages = result.value.pagination.totalPages;
			page += 1;
		} while (page <= totalPages);

		return documentIds;
	}

	async function getExistingWebsiteResourceDocumentIds(): Promise<Set<string>> {
		const documentIds = new Set<string>();
		let page = 1;
		let totalPages;

		do {
			const result = await searchService.collections.website.search({
				filterBy: externalSourcesFilter,
				page,
				perPage: 250,
				query: "*",
			});

			if (result.isErr()) {
				throw result.error;
			}

			for (const item of result.value.items) {
				documentIds.add(item.document.id);
			}

			totalPages = result.value.pagination.totalPages;
			page += 1;
		} while (page <= totalPages);

		return documentIds;
	}

	async function deleteStaleDocuments(params: {
		currentDocuments: Array<ResourceDocument | WebsiteDocument>;
		deleteDocument: (documentId: string) => Promise<Result<void, unknown>>;
		collection: string;
		existingDocumentIds: Set<string>;
		logContext: "resource" | "website resource";
	}): Promise<Array<StaleDocumentDeletion>> {
		const { collection, currentDocuments, deleteDocument, existingDocumentIds, logContext } =
			params;
		const currentDocumentIds = new Set(currentDocuments.map((document) => document.id));

		const failedDeletions: Array<StaleDocumentDeletion> = [];

		for (const documentId of existingDocumentIds) {
			if (currentDocumentIds.has(documentId)) {
				continue;
			}

			const result = await deleteDocument(documentId);

			if (result.isErr()) {
				log.error(`Failed to delete stale ${logContext} search document.`, {
					documentId,
					error: result.error,
				});

				failedDeletions.push({ collection, documentId });
			}
		}

		return failedDeletions;
	}

	async function syncSearchResources(
		options?: FetchSearchResourcesParams,
	): Promise<SyncSearchResourcesResult> {
		const sourceData = await fetchSearchIndexResourceSourceData(options);
		const resources = createResourceDocuments(sourceData);
		const websiteDocuments = createWebsiteResourceDocuments(resources);
		const [existingResourceDocumentIds, existingWebsiteResourceDocumentIds] = await Promise.all([
			getExistingResourceDocumentIds(),
			getExistingWebsiteResourceDocumentIds(),
		]);

		const resourcesIngestResult = await search.collections.resources.ingest(resources);
		if (resourcesIngestResult.isErr()) {
			throw resourcesIngestResult.error;
		}

		const websiteIngestResult = await search.collections.website.ingest(websiteDocuments);
		if (websiteIngestResult.isErr()) {
			throw websiteIngestResult.error;
		}

		const resourceFailedDeletions = await deleteStaleDocuments({
			collection: "resources",
			currentDocuments: resources,
			deleteDocument(documentId) {
				return search.collections.resources.delete(documentId);
			},
			existingDocumentIds: existingResourceDocumentIds,
			logContext: "resource",
		});
		const websiteFailedDeletions = await deleteStaleDocuments({
			collection: "website",
			currentDocuments: websiteDocuments,
			deleteDocument(documentId) {
				return search.collections.website.delete(documentId);
			},
			existingDocumentIds: existingWebsiteResourceDocumentIds,
			logContext: "website resource",
		});

		const failedDeletions = [...resourceFailedDeletions, ...websiteFailedDeletions];

		return {
			count: resources.length,
			failedCount: failedDeletions.length,
			failedDeletions,
			websiteCount: websiteDocuments.length,
		};
	}

	return {
		createResourceDocuments,
		fetchSearchIndexResourceSourceData,
		syncSearchResources,
	};
}
