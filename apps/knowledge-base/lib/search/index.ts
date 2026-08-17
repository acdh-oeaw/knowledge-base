import { assert } from "@acdh-oeaw/lib";
import { createSearchService } from "@dariah-eric/search";

import { env } from "@/config/env.config";
import { config } from "@/config/search.config";

assert(
	env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY,
	"Missing environment variable: `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY`.",
);

export const search = createSearchService({
	collections: {
		resources: env.NEXT_PUBLIC_TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.NEXT_PUBLIC_TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	apiKey: env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY,
	nodes: [
		{
			host: env.NEXT_PUBLIC_TYPESENSE_HOST,
			port: env.NEXT_PUBLIC_TYPESENSE_PORT,
			protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
		},
	],
	config,
});
