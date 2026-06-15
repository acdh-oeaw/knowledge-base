import { db } from "@/lib/db";

/**
 * Runs `fn` inside a transaction that is always rolled back — keeps test data out of the database
 * without needing a separate test database.
 */
export async function withTransaction(fn: Parameters<typeof db.transaction>[0]): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await fn(tx);
			tx.rollback();
		});
	} catch (error) {
		// oxlint-disable-next-line unicorn/no-instanceof-builtins
		if (error instanceof Error && error.message === "Rollback") {
			return;
		}
		throw error;
	}
}
