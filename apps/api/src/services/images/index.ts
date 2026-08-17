import { createImagesService } from "@dariah-eric/images";

import { env } from "~/config/env.config";

export const images = createImagesService({
	config: {
		baseUrl: env.IMGPROXY_BASE_URL,
		key: env.IMGPROXY_KEY,
		salt: env.IMGPROXY_SALT,
		storage: {
			bucketName: env.S3_BUCKET_NAME,
		},
	},
});
