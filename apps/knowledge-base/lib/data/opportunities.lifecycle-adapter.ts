import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const opportunitiesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				title: schema.opportunities.title,
				summary: schema.opportunities.summary,
				sourceId: schema.opportunities.sourceId,
				website: schema.opportunities.website,
				duration: schema.opportunities.duration,
			})
			.from(schema.opportunities)
			.where(eq(schema.opportunities.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.opportunities).values({ id: targetVersionId, ...source });
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.opportunities).where(eq(schema.opportunities.id, versionId));
	},
};
