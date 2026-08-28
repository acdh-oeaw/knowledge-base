import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const pagesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.pages)
			.where(eq(schema.pages.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.pages).values({ id: targetVersionId, ...subtypePayload(source) });
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.pages).where(eq(schema.pages.id, versionId));
	},
};
