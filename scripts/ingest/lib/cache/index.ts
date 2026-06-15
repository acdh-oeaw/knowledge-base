import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { log } from "@acdh-oeaw/lib";
import { Result, TaggedError } from "better-result";

export class CacheFileError extends TaggedError("CacheFileError")<{
	readonly cause?: unknown;
	readonly message?: string;
}>() {}

export interface CreateCacheServiceParams {
	cacheDir: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCacheService(params: CreateCacheServiceParams) {
	const { cacheDir } = params;

	return {
		async getOrFetch<T, E>(
			key: string,
			fetcher: () => Promise<Result<T, E>>,
		): Promise<Result<T, CacheFileError | E>> {
			const file = path.join(cacheDir, `${key}.json`);

			if (existsSync(file)) {
				log.info(`Cache hit for "${key}".`);

				return Result.tryPromise({
					// oxlint-disable-next-line typescript/no-unsafe-type-assertion
					try() {
						return readFile(file, { encoding: "utf-8" }).then(
							(content) => JSON.parse(content) as T,
						);
					},
					catch(cause) {
						return new CacheFileError({ cause });
					},
				});
			}

			log.info(`Cache miss for "${key}", fetching from API...`);

			const result = await fetcher();

			if (result.isOk()) {
				mkdirSync(path.dirname(file), { recursive: true });
				await writeFile(file, JSON.stringify(result.value, null, 2));
			}

			return result;
		},
	};
}

export type CacheService = ReturnType<typeof createCacheService>;
