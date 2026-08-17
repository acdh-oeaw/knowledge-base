import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const fundingCallsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				title: schema.fundingCalls.title,
				summary: schema.fundingCalls.summary,
				duration: schema.fundingCalls.duration,
			})
			.from(schema.fundingCalls)
			.where(eq(schema.fundingCalls.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.fundingCalls).values({ id: targetVersionId, ...source });
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.fundingCalls).where(eq(schema.fundingCalls.id, versionId));
	},
};
