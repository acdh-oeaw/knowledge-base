import type { StorageService } from "@dariah-eric/storage";
import { testClient } from "hono/testing";

import { api } from "@/app";
import { createApp } from "@/lib/factory";
import { type Database, type Transaction, database as databaseMiddleware } from "@/middlewares/db";
import { storage as storageMiddleware } from "@/middlewares/storage";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createTestClient(db: Database | Transaction, storage?: StorageService) {
	return testClient(
		createApp().use(databaseMiddleware(db)).use(storageMiddleware(storage)).route("/", api),
	);
}
