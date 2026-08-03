import * as p from "drizzle-orm/pg-core";

import * as f from "../fields";
import { entities } from "./entities";

export const tenancies = p.snakeCase.table(
	"tenancies",
	{
		entityId: p
			.uuid("entity_id")
			.notNull()
			.references(() => entities.id),
		tenantId: p
			.uuid("tenant_id")
			.notNull()
			.references(() => entities.id),
		...f.timestamps(),
	},
	(t) => [
		p.primaryKey({
			columns: [t.entityId, t.tenantId],
			name: "tenancies_pkey",
		}),
	],
);
