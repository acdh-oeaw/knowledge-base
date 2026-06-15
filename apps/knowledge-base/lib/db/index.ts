import {
	type Database,
	type Transaction,
	createDatabaseService,
	schema,
} from "@acdh-knowledge-base/database";

import { env } from "@/config/env.config";

export const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: env.NODE_ENV === "development",
}).unwrap();

export { type Database, schema, type Transaction };
