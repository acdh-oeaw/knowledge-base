import type { Database } from "@/middlewares/db";
import { db } from "@/services/db";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function withTransaction(fn: (db: Database) => Promise<void>) {
	try {
		await db.transaction(async (tx) => {
			await fn(tx as unknown as Database);
			tx.rollback();
		});
	} catch (error) {
		/** TransactionRollbackError */
		// oxlint-disable-next-line unicorn/no-instanceof-builtins
		if (error instanceof Error && error.message === "Rollback") {
			return;
		}

		throw error;
	}
}
