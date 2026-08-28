import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const documentationPagesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.documentationPages)
			.where(eq(schema.documentationPages.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx
			.insert(schema.documentationPages)
			.values({ id: targetVersionId, ...subtypePayload(source) });
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.documentationPages).where(eq(schema.documentationPages.id, versionId));
	},
};
