/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";

interface CreateEntitiesParams {
	data: Array<schema.EntityInput>;
}

export async function createEntities(params: CreateEntitiesParams) {
	const { data } = params;

	const entityIds = await db.insert(schema.entities).values(data).returning({
		id: schema.entities.id,
	});

	return entityIds;
}
