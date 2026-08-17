import { assert } from "@acdh-oeaw/lib";
import { createSearchAdminService } from "@dariah-eric/search/admin";

import { env } from "@/config/env.config";

assert(env.TYPESENSE_ADMIN_API_KEY, "Missing environment variable: `TYPESENSE_ADMIN_API_KEY`.");

export const search = createSearchAdminService({
	collections: {
		resources: env.NEXT_PUBLIC_TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.NEXT_PUBLIC_TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
	apiKey: env.TYPESENSE_ADMIN_API_KEY,
	nodes: [
		{
			host: env.NEXT_PUBLIC_TYPESENSE_HOST,
			port: env.NEXT_PUBLIC_TYPESENSE_PORT,
			protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
		},
	],
});
