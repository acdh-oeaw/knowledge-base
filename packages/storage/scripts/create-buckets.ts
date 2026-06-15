import { log } from "@acdh-oeaw/lib";

import { env } from "../config/env.config";
import { createStorageAdminService } from "../lib/admin";

const admin = createStorageAdminService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});

async function main() {
	(await admin.buckets.create()).unwrap();
	log.success(`Successfully created bucket "${env.S3_BUCKET_NAME}".`);
}

main().catch((error: unknown) => {
	log.error(`Failed to create bucket "${env.S3_BUCKET_NAME}".\n`, error);
	process.exitCode = 1;
});
