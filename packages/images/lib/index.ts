import type { Options } from "@imgproxy/imgproxy-js-core";
import { generateImageUrl } from "@imgproxy/imgproxy-node";

export type ImageUrlOptions = Options;

export interface CreateImagesServiceParams {
	config: {
		baseUrl: string;
		key: string;
		salt: string;
		storage: {
			bucketName: string;
		};
	};
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createImagesService(params: CreateImagesServiceParams) {
	const { config } = params;

	function generateSignedImageUrl(params: { key: string; options: Options }) {
		const { key, options } = params;

		const url = generateImageUrl({
			endpoint: config.baseUrl,
			key: config.key,
			options,
			salt: config.salt,
			url: `s3://${config.storage.bucketName}/${key}`,
		});

		return { url };
	}

	const service = {
		generateSignedImageUrl,
	};

	return service;
}

export type ImagesService = ReturnType<typeof createImagesService>;
