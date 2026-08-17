import { assert, log } from "@acdh-oeaw/lib";
import { createSshocClient } from "@dariah-eric/client-sshoc";
import { createDatabaseService } from "@dariah-eric/database";
import { ingestSshocServices } from "@dariah-eric/sshoc-services";

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

async function main(): Promise<void> {
	const result = await ingestSshocServices({
		db,
		sshoc,
		sshocMarketplaceBaseUrl: env.SSHOC_MARKETPLACE_BASE_URL!,
	});

	log.success(JSON.stringify(result, null, 2));
}

main()
	.catch((error: unknown) => {
		log.error(error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return
	.finally(() => db.$client.end());
