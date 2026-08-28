import { assert } from "@acdh-oeaw/lib";
import { createDariahCampusClient } from "@dariah-eric/client-campus";
import { createEpisciencesClient } from "@dariah-eric/client-episciences";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import { createZenodoClient } from "@dariah-eric/client-zenodo";
import { createZoteroClient } from "@dariah-eric/client-zotero";
import { createSearchService } from "@dariah-eric/search";
import {
	type SyncSearchResourcesResult,
	createSearchResourcesService,
	loadOrgUnitLookups,
} from "@dariah-eric/search-resources";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { search } from "@/lib/search/admin";

/** Aliased rather than re-declared, so the admin task cannot drift from what the service returns. */
export type SyncResourcesSearchIndexResult = SyncSearchResourcesResult;

export async function syncResourcesSearchIndex(): Promise<SyncResourcesSearchIndexResult> {
	assert(env.CAMPUS_API_BASE_URL, "Missing environment variable: `CAMPUS_API_BASE_URL`.");
	assert(env.EPISCIENCES_API_BASE_URL, "Missing environment variable: `EPISCIENCES_API_BASE_URL`.");
	assert(
		env.SSHOC_MARKETPLACE_API_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_API_BASE_URL`.",
	);
	assert(
		env.SSHOC_MARKETPLACE_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_BASE_URL`.",
	);
	assert(env.ZENODO_API_BASE_URL, "Missing environment variable: `ZENODO_API_BASE_URL`.");
	assert(env.ZOTERO_API_BASE_URL, "Missing environment variable: `ZOTERO_API_BASE_URL`.");
	assert(env.ZOTERO_GROUP_ID, "Missing environment variable: `ZOTERO_GROUP_ID`.");

	const sshocMarketplaceBaseUrl = env.SSHOC_MARKETPLACE_BASE_URL;
	const zoteroGroupId = env.ZOTERO_GROUP_ID;

	const campus = createDariahCampusClient({
		config: {
			baseUrl: env.CAMPUS_API_BASE_URL,
		},
	});

	const episciences = createEpisciencesClient({
		config: {
			baseUrl: env.EPISCIENCES_API_BASE_URL,
		},
	});

	const sshoc = createSshocClient({
		config: {
			baseUrl: env.SSHOC_MARKETPLACE_API_BASE_URL,
		},
	});

	const zenodo = createZenodoClient({
		baseUrl: env.ZENODO_API_BASE_URL,
		apiKey: env.ZENODO_API_KEY,
	});

	const zotero = createZoteroClient({
		config: {
			apiKey: env.ZOTERO_API_KEY,
			baseUrl: env.ZOTERO_API_BASE_URL,
		},
	});

	const searchService = createSearchService({
		apiKey: env.TYPESENSE_ADMIN_API_KEY,
		collections: {
			resources: env.NEXT_PUBLIC_TYPESENSE_RESOURCE_COLLECTION_NAME,
			website: env.NEXT_PUBLIC_TYPESENSE_WEBSITE_COLLECTION_NAME,
		},
		nodes: [
			{
				host: env.NEXT_PUBLIC_TYPESENSE_HOST,
				port: env.NEXT_PUBLIC_TYPESENSE_PORT,
				protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
			},
		],
	});

	const orgUnits = await loadOrgUnitLookups(db);

	const searchResources = createSearchResourcesService({
		campus,
		episciences,
		search,
		searchService,
		sshoc,
		sshocMarketplaceBaseUrl,
		zenodo,
		zotero,
		zoteroGroupId,
		orgUnits,
	});

	return searchResources.syncSearchResources();
}
