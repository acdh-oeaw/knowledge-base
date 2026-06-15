import { log } from "@acdh-oeaw/lib";

import { env } from "../config/env.config";
import { createSearchAdminService } from "../lib/admin";

const admin = createSearchAdminService({
	apiKey: env.TYPESENSE_ADMIN_API_KEY,
	nodes: [
		{
			host: env.TYPESENSE_HOST,
			port: env.TYPESENSE_PORT,
			protocol: env.TYPESENSE_PROTOCOL,
		},
	],
	collections: {
		resources: env.TYPESENSE_RESOURCE_COLLECTION_NAME,
		website: env.TYPESENSE_WEBSITE_COLLECTION_NAME,
	},
});

async function main() {
	(await admin.collections.resources.create()).unwrap();
	log.success(`Successfully created collection "${env.TYPESENSE_RESOURCE_COLLECTION_NAME}".`);

	(await admin.collections.website.create()).unwrap();
	log.success(`Successfully created collection "${env.TYPESENSE_WEBSITE_COLLECTION_NAME}".`);
}

main().catch((error: unknown) => {
	log.error("Failed to create collections.\n", error);
	process.exitCode = 1;
});
