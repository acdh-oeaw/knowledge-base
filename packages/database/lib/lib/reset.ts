import { reset as _reset } from "drizzle-seed";

import * as schema from "../schema";
import type { Client } from "./admin-client";

export async function reset(db: Client): Promise<void> {
	await _reset(db, schema);
}
