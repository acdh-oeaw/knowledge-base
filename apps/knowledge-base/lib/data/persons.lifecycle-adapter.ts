import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const personsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.persons)
			.where(eq(schema.persons.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.persons).values({ id: targetVersionId, ...subtypePayload(source) });

		// personSocialMedia is version-scoped (keyed by persons.id) and subtype-owned, so it is copied
		// forward here. personsToOrganisationalUnits is a document-level relation (keyed by
		// entities.id) and is not cloned per version — see persons.ts schema.
		const links = await tx
			.select({
				label: schema.personSocialMedia.label,
				position: schema.personSocialMedia.position,
				typeId: schema.personSocialMedia.typeId,
				url: schema.personSocialMedia.url,
			})
			.from(schema.personSocialMedia)
			.where(eq(schema.personSocialMedia.personId, sourceVersionId));

		if (links.length > 0) {
			await tx.insert(schema.personSocialMedia).values(
				links.map((link) => {
					return { personId: targetVersionId, ...link };
				}),
			);
		}
	},

	async wipeSubtype(tx, versionId) {
		// Links reference the persons row, so they go first.
		await tx
			.delete(schema.personSocialMedia)
			.where(eq(schema.personSocialMedia.personId, versionId));
		await tx.delete(schema.persons).where(eq(schema.persons.id, versionId));
	},
};
