import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const personsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				email: schema.persons.email,
				imageId: schema.persons.imageId,
				name: schema.persons.name,
				orcid: schema.persons.orcid,
				sortName: schema.persons.sortName,
			})
			.from(schema.persons)
			.where(eq(schema.persons.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.persons).values({ id: targetVersionId, ...source });

		// personsToOrganisationalUnits is a document-level relation (keyed by entities.id) and is
		// not cloned per version — see persons.ts schema.
	},

	async wipeSubtype(tx, versionId) {
		await tx.delete(schema.persons).where(eq(schema.persons.id, versionId));
	},
};
