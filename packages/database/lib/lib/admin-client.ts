import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../../config/env.config";

export type Client = Awaited<ReturnType<typeof createClient>>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createClient() {
	const client = new Pool({
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		/** Ensure single connection. */
		max: 1,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	});

	const db = drizzle({
		client,
		logger: true,
	});

	return db;
}

export const db = createClient();
