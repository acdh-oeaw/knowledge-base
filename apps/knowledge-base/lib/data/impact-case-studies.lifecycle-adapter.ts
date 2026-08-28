import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const impactCaseStudiesLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.impactCaseStudies)
			.where(eq(schema.impactCaseStudies.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx
			.insert(schema.impactCaseStudies)
			.values({ id: targetVersionId, ...subtypePayload(source) });

		// Contributors (impactCaseStudiesToPersons) are document-level and shared across versions, so
		// they are not cloned here.
	},

	async wipeSubtype(tx, versionId) {
		// Contributors are document-level; they are removed by deleteDocumentVersionTail when the whole
		// document is deleted, not when a single version is wiped.
		await tx.delete(schema.impactCaseStudies).where(eq(schema.impactCaseStudies.id, versionId));
	},
};
