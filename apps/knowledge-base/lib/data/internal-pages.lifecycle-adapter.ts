import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const internalPagesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.internalPages)
			.where(eq(schema.internalPages.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx
			.insert(schema.internalPages)
			.values({ id: targetVersionId, ...subtypePayload(source) });
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.internalPages).where(eq(schema.internalPages.id, versionId));
	},
};
