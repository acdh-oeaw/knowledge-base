import { assert } from "@acdh-oeaw/lib";
import { createSearchService } from "@dariah-eric/search";

import { env } from "~/config/env.config";
import { config } from "~/config/search.config";

assert(env.TYPESENSE_SEARCH_API_KEY, "Missing environment variable: `TYPESENSE_SEARCH_API_KEY`.");

export const search = createSearchService({
	collections: {
		resources: env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	apiKey: env.TYPESENSE_SEARCH_API_KEY,
	nodes: [
		{
			host: env.TYPESENSE_HOST,
			port: env.TYPESENSE_PORT,
			protocol: env.TYPESENSE_PROTOCOL,
		},
	],
	config,
});
