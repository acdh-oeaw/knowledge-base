import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const organisationalUnitsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				acronym: schema.organisationalUnits.acronym,
				ror: schema.organisationalUnits.ror,
				imageId: schema.organisationalUnits.imageId,
				metadata: schema.organisationalUnits.metadata,
				name: schema.organisationalUnits.name,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				summary: schema.organisationalUnits.summary,
				typeId: schema.organisationalUnits.typeId,
			})
			.from(schema.organisationalUnits)
			.where(eq(schema.organisationalUnits.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.organisationalUnits).values({ id: targetVersionId, ...source });

		// personsToOrganisationalUnits and organisationalUnitsRelations are document-level relations
		// (keyed by entities.id) and are not cloned per version — see the schema.

		const socialMedia = await tx
			.select({ socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId })
			.from(schema.organisationalUnitsToSocialMedia)
			.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, sourceVersionId));

		if (socialMedia.length > 0) {
			await tx.insert(schema.organisationalUnitsToSocialMedia).values(
				socialMedia.map((s) => {
					return { organisationalUnitId: targetVersionId, ...s };
				}),
			);
		}
	},

	async replaceSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				acronym: schema.organisationalUnits.acronym,
				ror: schema.organisationalUnits.ror,
				imageId: schema.organisationalUnits.imageId,
				metadata: schema.organisationalUnits.metadata,
				name: schema.organisationalUnits.name,
				sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
				summary: schema.organisationalUnits.summary,
				typeId: schema.organisationalUnits.typeId,
			})
			.from(schema.organisationalUnits)
			.where(eq(schema.organisationalUnits.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}

		await tx
			.update(schema.organisationalUnits)
			.set(source)
			.where(eq(schema.organisationalUnits.id, targetVersionId));

		await tx
			.delete(schema.organisationalUnitsToSocialMedia)
			.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, targetVersionId));

		const socialMedia = await tx
			.select({ socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId })
			.from(schema.organisationalUnitsToSocialMedia)
			.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, sourceVersionId));

		if (socialMedia.length > 0) {
			await tx.insert(schema.organisationalUnitsToSocialMedia).values(
				socialMedia.map((s) => {
					return { organisationalUnitId: targetVersionId, ...s };
				}),
			);
		}
	},

	async wipeSubtype(tx, versionId) {
		await tx
			.delete(schema.organisationalUnitsToSocialMedia)
			.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, versionId));
		await tx.delete(schema.organisationalUnits).where(eq(schema.organisationalUnits.id, versionId));
	},
};
