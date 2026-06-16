import { assert } from "@acdh-oeaw/lib";
import { createSshocClient } from "@acdh-knowledge-base/client-sshoc";
import { createZoteroClient } from "@acdh-knowledge-base/client-zotero";
import { createSearchService } from "@acdh-knowledge-base/search";
import { createSearchResourcesService, loadOrgUnitLookups } from "@acdh-knowledge-base/search-resources";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";
import { search } from "@/lib/search/admin";

export interface SyncResourcesSearchIndexResult {
	count: number;
	failedCount: number;
	websiteCount: number;
}

export async function syncResourcesSearchIndex(): Promise<SyncResourcesSearchIndexResult> {
	assert(
		env.SSHOC_MARKETPLACE_API_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_API_BASE_URL`.",
	);
	assert(
		env.SSHOC_MARKETPLACE_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_BASE_URL`.",
	);
	assert(env.ZOTERO_API_BASE_URL, "Missing environment variable: `ZOTERO_API_BASE_URL`.");
	assert(env.ZOTERO_GROUP_ID, "Missing environment variable: `ZOTERO_GROUP_ID`.");

	const sshocMarketplaceBaseUrl = env.SSHOC_MARKETPLACE_BASE_URL;
	const zoteroGroupId = env.ZOTERO_GROUP_ID;

	const sshoc = createSshocClient({
		config: {
			baseUrl: env.SSHOC_MARKETPLACE_API_BASE_URL,
		},
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
		search,
		searchService,
		sshoc,
		sshocMarketplaceBaseUrl,
		zotero,
		zoteroGroupId,
		orgUnits,
	});

	return searchResources.syncSearchResources();
}
