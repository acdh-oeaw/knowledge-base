import { assert } from "@acdh-oeaw/lib";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import {
	type IngestSshocServicesResult,
	ingestSshocServices as ingestSshocServicesWithDependencies,
} from "@dariah-eric/sshoc-services";

import { env } from "@/config/env.config";
import { db } from "@/lib/db";

export async function ingestSshocServices(): Promise<IngestSshocServicesResult> {
	assert(
		env.SSHOC_MARKETPLACE_API_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_API_BASE_URL`.",
	);
	assert(
		env.SSHOC_MARKETPLACE_BASE_URL,
		"Missing environment variable: `SSHOC_MARKETPLACE_BASE_URL`.",
	);

	const sshoc = createSshocClient({
		config: {
			baseUrl: env.SSHOC_MARKETPLACE_API_BASE_URL,
		},
	});

	return ingestSshocServicesWithDependencies({
		db,
		sshoc,
		sshocMarketplaceBaseUrl: env.SSHOC_MARKETPLACE_BASE_URL,
	});
}
