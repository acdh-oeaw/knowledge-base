import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const spotlightArticlesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				title: schema.spotlightArticles.title,
				summary: schema.spotlightArticles.summary,
				imageId: schema.spotlightArticles.imageId,
			})
			.from(schema.spotlightArticles)
			.where(eq(schema.spotlightArticles.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.spotlightArticles).values({ id: targetVersionId, ...source });

		// Contributors (spotlightArticlesToPersons) are document-level and shared across versions, so
		// they are not cloned here.
	},

	async wipeSubtype(tx, versionId) {
		// Contributors are document-level; they are removed by deleteDocumentVersionTail when the whole
		// document is deleted, not when a single version is wiped.
		await tx.delete(schema.spotlightArticles).where(eq(schema.spotlightArticles.id, versionId));
	},
};
