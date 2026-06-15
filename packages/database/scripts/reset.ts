import { log } from "@acdh-oeaw/lib";

import { db } from "../lib/lib/admin-client";
import { reset } from "../lib/lib/reset";

async function main() {
	await reset(db);

	log.success("Successfully reset database.");
}

main()
	.catch((error: unknown) => {
		log.error("Failed to reset database.\n", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
