import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import { createZoteroClient } from "@dariah-eric/client-zotero";
import { db } from "@dariah-eric/database/client";
import { createSearchService } from "@dariah-eric/search";
import { createSearchResourcesService, loadOrgUnitLookups } from "@dariah-eric/search-resources";
import { createSearchAdminService } from "@dariah-eric/search/admin";

import { env } from "../config/env.config.ts";
import { createCacheService } from "../lib/cache/index.ts";

const cache = createCacheService({
	cacheDir: path.join(process.cwd(), ".cache"),
});

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

const search = createSearchAdminService({
	apiKey: env.TYPESENSE_ADMIN_API_KEY,
	collections: {
		resources: env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	nodes: [
		{
			host: env.TYPESENSE_HOST,
			port: env.TYPESENSE_PORT,
			protocol: env.TYPESENSE_PROTOCOL,
		},
	],
});

const searchService = createSearchService({
	apiKey: env.TYPESENSE_ADMIN_API_KEY,
	collections: {
		resources: env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	nodes: [
		{
			host: env.TYPESENSE_HOST,
			port: env.TYPESENSE_PORT,
			protocol: env.TYPESENSE_PROTOCOL,
		},
	],
});

async function main(): Promise<void> {
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

	const result = await searchResources.syncSearchResources({ cache });

	log.success(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
	log.error(error);
	process.exitCode = 1;
});
