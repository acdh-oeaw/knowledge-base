import type { Readable } from "node:stream";

import { Result } from "better-result";
import { Client, type ItemBucketMetadata } from "minio";
import { v7 as uuidv7 } from "uuid";

import type { AssetPrefix } from "../config/images.config";
import { StorageDeleteError, StorageDownloadError, StorageUploadError } from "./errors";

function generateObjectKey(prefix: AssetPrefix): string {
	const objectName = `${prefix}/${uuidv7()}`;

	return objectName;
}

export interface AssetMetadata extends ItemBucketMetadata {
	"content-type": string;
}

export interface CreateStorageServiceParams {
	config: {
		accessKey: string;
		bucketName: string;
		endPoint: string;
		port: number;
		secretKey: string;
		useSSL: boolean;
	};
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createStorageService(params: CreateStorageServiceParams) {
	const { accessKey, bucketName, endPoint, port, secretKey, useSSL } = params.config;

	const client = new Client({
		accessKey,
		endPoint,
		port,
		secretKey,
		useSSL,
	});

	return {
		// oxlint-disable-next-line typescript/explicit-module-boundary-types
		upload({
			input,
			metadata,
			prefix,
			size,
		}: {
			input: Readable | Buffer;
			metadata: AssetMetadata;
			prefix: AssetPrefix;
			size?: number;
		}) {
			return Result.tryPromise({
				async try() {
					const key = generateObjectKey(prefix);
					await client.putObject(bucketName, key, input, size, metadata);
					return { key };
				},
				catch(cause) {
					return new StorageUploadError({ cause });
				},
			});
		},

		// oxlint-disable-next-line typescript/explicit-module-boundary-types
		stat(key: string) {
			return Result.tryPromise({
				async try() {
					const { size } = await client.statObject(bucketName, key);
					return { size };
				},
				catch(cause) {
					return new StorageDownloadError({ cause });
				},
			});
		},

		// oxlint-disable-next-line typescript/explicit-module-boundary-types
		download(key: string) {
			return Result.tryPromise({
				async try() {
					return client.getObject(bucketName, key);
				},
				catch(cause) {
					return new StorageDownloadError({ cause });
				},
			});
		},

		// oxlint-disable-next-line typescript/explicit-module-boundary-types
		delete(key: string) {
			return Result.tryPromise({
				async try() {
					return client.removeObject(bucketName, key);
				},
				catch(cause) {
					return new StorageDeleteError({ cause });
				},
			});
		},
	};
}

export type StorageService = ReturnType<typeof createStorageService>;
