import { parseArgs } from "node:util";

import { log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import { createSearchAdminService } from "@dariah-eric/search/admin";
import { createStorageService } from "@dariah-eric/storage";
import * as v from "valibot";

import { env } from "../config/env.config";
import { seed as seedDatabase } from "../lib/seed-database";
import { seed as seedSearchIndex } from "../lib/seed-search-index";
import { type SeedManifest, seed as seedObjectStore } from "../lib/seed-storage";

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: false,
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

const storage = createStorageService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

const _services = ["database", "object-store", "search-index"] as const;

const ArgsSchema = v.pipe(
	v.array(v.picklist(_services)),
	v.transform((value) => (value.length === 0 ? _services : value)),
);

async function main() {
	const { positionals } = parseArgs({ allowPositionals: true });
	const services = new Set(v.parse(ArgsSchema, positionals));

	let seedManifest: SeedManifest | undefined;

	if (services.has("object-store")) {
		log.info("Seeding object-store...");
		seedManifest = await seedObjectStore(storage);
	}

	if (services.has("database")) {
		log.info("Seeding database...");
		await seedDatabase(db, { seedManifest });
	}

	if (services.has("search-index")) {
		log.info("Seeding search-index...");
		await seedSearchIndex(search);
	}

	log.success("Successfully seeded services.");
}

main()
	.catch((error: unknown) => {
		log.error("Failed to seed services.", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
