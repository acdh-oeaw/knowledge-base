import type * as schema from "@dariah-eric/database/schema";

import type { asc, sql } from "@/services/db/sql";

/** Order a many-to-many assets relation by its junction row. */
export const assetsByPosition = {
	orderBy(
		_table: typeof schema.assets,
		operators: { asc: typeof asc; sql: typeof sql },
	): Array<ReturnType<typeof asc>> {
		return [operators.asc(operators.sql.identifier("position")), operators.asc(_table.id)];
	},
};
