import { parseArgs } from "node:util";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { createSearchService } from "@dariah-eric/search";
import {
	type SupportedWebsiteEntityType,
	createWebsiteSearchIndexService,
	supportedWebsiteEntityTypes,
} from "@dariah-eric/search-website";
import { createSearchAdminService } from "@dariah-eric/search/admin";

import { env } from "../config/env.config.ts";

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

const websiteSearchIndex = createWebsiteSearchIndexService({ db, search, searchService });

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		all: {
			type: "boolean",
		},
		entityId: {
			type: "string",
		},
		entityIds: {
			type: "string",
		},
		type: {
			type: "string",
		},
	},
});

function createEntityIds(): Promise<Array<string>> {
	if (values.all === true) {
		return websiteSearchIndex.getSyncableWebsiteEntityIdsByType();
	}

	if (values.type != null) {
		if (!supportedWebsiteEntityTypes.includes(values.type as SupportedWebsiteEntityType)) {
			throw new Error(
				`Invalid entity type "${values.type}". Expected one of: ${supportedWebsiteEntityTypes.join(", ")}.`,
			);
		}

		return websiteSearchIndex.getSyncableWebsiteEntityIdsByType(
			values.type as SupportedWebsiteEntityType,
		);
	}

	if (values.entityId != null) {
		return Promise.resolve([values.entityId]);
	}

	if (values.entityIds != null) {
		const entityIds = values.entityIds
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0);

		if (entityIds.length === 0) {
			throw new Error("Expected at least one entity id in --entityIds.");
		}

		return Promise.resolve(entityIds);
	}

	throw new Error("Expected one of --all, --type, --entityId, or --entityIds.");
}

async function main(): Promise<void> {
	if (values.all === true) {
		const result = await websiteSearchIndex.syncWebsiteSearchIndex();

		log.info(
			JSON.stringify(
				{
					count: result.count,
					failedCount: result.failedCount,
					ok: result.failedCount === 0,
				},
				null,
				2,
			),
		);

		return;
	}

	const entityIds = await createEntityIds();
	const items = await Promise.all(
		entityIds.map((entityId) =>
			websiteSearchIndex.syncWebsiteDocumentForEntityWithResult(entityId),
		),
	);

	log.success(
		JSON.stringify(
			{
				count: items.length,
				ok: items.every((item) => item.ok),
				items,
			},
			null,
			2,
		),
	);
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
