import { assert } from "@acdh-oeaw/lib";
import { Result } from "better-result";
import { Client } from "minio";

import { StorageBucketError } from "./errors";

export interface CreateStorageAdminServiceParams {
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
export function createStorageAdminService(params: CreateStorageAdminServiceParams) {
	const { accessKey, bucketName, endPoint, port, secretKey, useSSL } = params.config;

	const client = new Client({
		accessKey,
		endPoint,
		port,
		secretKey,
		useSSL,
	});

	return {
		buckets: {
			create(): Promise<Result<void, StorageBucketError>> {
				return Result.tryPromise({
					async try() {
						if (await client.bucketExists(bucketName)) {
							return;
						}

						await client.makeBucket(bucketName);
					},
					catch(cause) {
						return new StorageBucketError({ cause });
					},
				});
			},

			async reset(): Promise<Result<void, StorageBucketError>> {
				return Result.tryPromise({
					async try() {
						const items: Array<string> = [];

						let continuationToken = "";
						do {
							const result = await client.listObjectsV2Query(
								bucketName,
								"",
								continuationToken,
								"",
								100,
								"",
							);

							for (const item of result.objects) {
								const { name } = item;
								assert(name, "Bucket item is missing name.");
								items.push(name);
							}

							continuationToken = result.isTruncated ? result.nextContinuationToken : "";
						} while (continuationToken);

						const chunkSize = 1000;
						for (let i = 0; i < items.length; i += chunkSize) {
							await client.removeObjects(bucketName, items.slice(i, i + chunkSize));
						}
					},
					catch(cause) {
						return new StorageBucketError({ cause });
					},
				});
			},

			// oxlint-disable-next-line typescript/explicit-module-boundary-types
			async copy(params: {
				source: {
					bucket: string;
					key: string;
				};
				prefix: string;
			}) {
				return Result.tryPromise({
					async try() {
						const { source, prefix } = params;

						const key = `${prefix}/${source.key}`;
						await client.copyObject(bucketName, key, `/${source.bucket}/${source.key}`);
						const stat = await client.statObject(bucketName, key);
						const meta = stat.metaData as Record<string, string>;
						const metadata = {
							...meta,
							"content-type": meta["content-type"] ?? "application/octet-stream",
						};

						return { key, metadata };
					},
					catch(cause) {
						return new StorageBucketError({ cause });
					},
				});
			},
		},
	};
}

export type StorageAdminService = ReturnType<typeof createStorageAdminService>;
