import * as path from "node:path";

import { assert, log } from "@acdh-oeaw/lib";
import { createDariahCampusClient } from "@dariah-eric/client-campus";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import { createZenodoClient } from "@dariah-eric/client-zenodo";
import { createDatabaseService } from "@dariah-eric/database";
import { createSearchService } from "@dariah-eric/search";
import { createSearchResourcesService, loadOrgUnitLookups } from "@dariah-eric/search-resources";
import { createWebsiteSearchIndexService } from "@dariah-eric/search-website";
import { createSearchAdminService } from "@dariah-eric/search/admin";

import { env } from "../config/env.config.ts";
import { createCacheService } from "../lib/cache/index.ts";

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: true,
}).unwrap();

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

const cache = createCacheService({
	cacheDir: path.join(process.cwd(), ".cache"),
});

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

const websiteSearchIndex = createWebsiteSearchIndexService({ db, search, searchService });

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

	const resources = await searchResources.syncSearchResources({ cache });

	log.success(
		`Synced ${String(resources.count)} external resources to resources and website indexes with ${String(resources.failedCount)} stale-delete failures.`,
	);

	const website = await websiteSearchIndex.syncWebsiteSearchIndex();

	log.success(`Synced ${String(website.count)} website entity documents.`);

	log.success("Successfully ingested data.");
}

main()
	.catch((error: unknown) => {
		log.error("Failed to ingest data.\n", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
