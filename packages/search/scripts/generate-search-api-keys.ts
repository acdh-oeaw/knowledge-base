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
	const key = (await admin.apiKeys.create()).unwrap();

	if (process.argv.includes("--raw")) {
		// eslint-disable-next-line no-console
		console.log(key);
		return;
	}

	log.success(`Successfully generated search API key: ${key}`);
}

main().catch((error: unknown) => {
	log.error("Failed to generate search API key.\n", error);
	process.exitCode = 1;
});
