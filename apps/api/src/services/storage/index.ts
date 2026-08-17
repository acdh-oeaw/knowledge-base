import { createStorageService } from "@dariah-eric/storage";

import { env } from "~/config/env.config";

export const storage = createStorageService({
	config: {
		accessKey: env.S3_ACCESS_KEY,
		bucketName: env.S3_BUCKET_NAME,
		endPoint: env.S3_HOST,
		port: env.S3_PORT,
		secretKey: env.S3_SECRET_KEY,
		useSSL: env.S3_PROTOCOL === "https",
	},
});
