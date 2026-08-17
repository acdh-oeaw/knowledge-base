import * as schema from "@dariah-eric/database/schema";

import type { EntityLifecycleAdapter } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";

export const projectsLifecycleAdapter: EntityLifecycleAdapter = {
	async cloneSubtype(tx, sourceVersionId, targetVersionId) {
		const [source] = await tx
			.select({
				acronym: schema.projects.acronym,
				call: schema.projects.call,
				duration: schema.projects.duration,
				funding: schema.projects.funding,
				imageId: schema.projects.imageId,
				metadata: schema.projects.metadata,
				name: schema.projects.name,
				scopeId: schema.projects.scopeId,
				summary: schema.projects.summary,
				topic: schema.projects.topic,
			})
			.from(schema.projects)
			.where(eq(schema.projects.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}
		await tx.insert(schema.projects).values({ id: targetVersionId, ...source });

		// projectsToOrganisationalUnits is a document-level relation (keyed by entities.id) and is not
		// cloned per version — see projects.ts schema.

		const socialMedia = await tx
			.select({ socialMediaId: schema.projectsToSocialMedia.socialMediaId })
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
			.select({
				acronym: schema.projects.acronym,
				call: schema.projects.call,
				duration: schema.projects.duration,
				funding: schema.projects.funding,
				imageId: schema.projects.imageId,
				metadata: schema.projects.metadata,
				name: schema.projects.name,
				scopeId: schema.projects.scopeId,
				summary: schema.projects.summary,
				topic: schema.projects.topic,
			})
			.from(schema.projects)
			.where(eq(schema.projects.id, sourceVersionId))
			.limit(1);
		if (source == null) {
			return;
		}

		await tx
			.delete(schema.projectsToSocialMedia)
			.where(eq(schema.projectsToSocialMedia.projectId, targetVersionId));

		await tx.update(schema.projects).set(source).where(eq(schema.projects.id, targetVersionId));

		const socialMedia = await tx
			.select({ socialMediaId: schema.projectsToSocialMedia.socialMediaId })
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
