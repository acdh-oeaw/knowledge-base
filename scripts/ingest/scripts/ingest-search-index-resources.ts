import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { createDariahCampusClient } from "@dariah-eric/client-campus";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import { createZenodoClient } from "@dariah-eric/client-zenodo";
import { db } from "@dariah-eric/database/client";
import { createSearchService } from "@dariah-eric/search";
import { createSearchResourcesService, loadOrgUnitLookups } from "@dariah-eric/search-resources";
import { createSearchAdminService } from "@dariah-eric/search/admin";

import { env } from "../config/env.config.ts";
import { createCacheService } from "../lib/cache/index.ts";

const cache = createCacheService({
	cacheDir: path.join(process.cwd(), ".cache"),
});

assert(env.CAMPUS_API_BASE_URL, "Missing environment variable: `CAMPUS_API_BASE_URL`.");
assert(
	env.SSHOC_MARKETPLACE_API_BASE_URL,
	"Missing environment variable: `SSHOC_MARKETPLACE_API_BASE_URL`.",
);
assert(
	env.SSHOC_MARKETPLACE_BASE_URL,
	"Missing environment variable: `SSHOC_MARKETPLACE_BASE_URL`.",
);
assert(env.ZENODO_API_BASE_URL, "Missing environment variable: `ZENODO_API_BASE_URL`.");

const sshocMarketplaceBaseUrl = env.SSHOC_MARKETPLACE_BASE_URL;

const campus = createDariahCampusClient({
	config: {
		baseUrl: env.CAMPUS_API_BASE_URL,
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
		campus,
		search,
		searchService,
		sshoc,
		sshocMarketplaceBaseUrl,
		zenodo,
		orgUnits,
	});

	const result = await searchResources.syncSearchResources({ cache });

	log.success(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
	log.error(error);
	process.exitCode = 1;
});
