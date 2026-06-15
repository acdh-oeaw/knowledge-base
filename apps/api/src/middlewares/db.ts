import { createMiddleware } from "@/lib/factory";
import { type Database, type Transaction, db as client } from "@/services/db";

export type { Database, Transaction };

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function database(db: Database | Transaction = client) {
	return createMiddleware(async (c, next) => {
		c.set("db", db);
		await next();
	});
}
