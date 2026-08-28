import * as schema from "@dariah-eric/database/schema";

import { type EntityLifecycleAdapter, subtypePayload } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const projectsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.projects).values({ id: targetVersionId, ...subtypePayload(source) });

		// projectsToOrganisationalUnits is a document-level relation (keyed by entities.id) and is not
		// cloned per version — see projects.ts schema.

		const socialMedia = await tx
			.select({
				position: schema.projectsToSocialMedia.position,
				socialMediaId: schema.projectsToSocialMedia.socialMediaId,
			})
			.from(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, sourceVersionId));

		if (socialMedia.length > 0) {
			await tx.insert(schema.projectsToSocialMedia).values(
				socialMedia.map((s) => {
					return { projectId: targetVersionId, ...s };
				}),
			);
		}
	},

	async wipeSubtype(tx, versionId) {
		await tx
			.delete(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, versionId));
		await tx.delete(schema.projects).where(eq(schema.projects.id, versionId));
	},

	async replaceSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}

		await tx
			.delete(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, targetVersionId));

		await tx
			.update(schema.projects)
			.set(subtypePayload(source))
			.where(eq(schema.projects.id, targetVersionId));

		const socialMedia = await tx
			.select({
				position: schema.projectsToSocialMedia.position,
				socialMediaId: schema.projectsToSocialMedia.socialMediaId,
			})
			.from(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, sourceVersionId));

		if (socialMedia.length > 0) {
			await tx.insert(schema.projectsToSocialMedia).values(
				socialMedia.map((s) => {
					return { projectId: targetVersionId, ...s };
				}),
			);
		}
	},
};
