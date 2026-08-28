import { Result } from "better-result";
import type { DrizzleConfig } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolConfig } from "pg";

import { DatabaseConnectionError } from "./errors";
import { relations } from "./relations";
import * as schema from "./schema";

export { relations, schema };

interface CreateClientParams {
	connection: string | PoolConfig;
	logger: DrizzleConfig["logger"];
}

function createClient(params: CreateClientParams) {
	const { connection, logger } = params;

	const db = drizzle({
		connection,
		logger,
		relations,
	});

	return db;
}

export type Database = ReturnType<typeof createClient>;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

declare global {
	var __db: Database | undefined;
}

export interface CreateDatabaseServiceParams extends CreateClientParams {}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createDatabaseService(params: CreateDatabaseServiceParams) {
	if (globalThis.__db != null) {
		return Result.ok(globalThis.__db);
	}

	return Result.try({
		try() {
			const db = createClient(params);

			/** Avoid creating multiple connection pools. */
			globalThis.__db = db;

			return db;
		},
		catch(cause) {
			return new DatabaseConnectionError({ cause });
		},
	});
}

export type DatabaseService = ReturnType<typeof createDatabaseService>;

//

export { alias } from "drizzle-orm/pg-core";
export * from "drizzle-orm/sql";
export * from "./image-captions";
export { plainTextToRichText } from "./rich-text";
