import * as schema from "@dariah-eric/database/schema";

import type { Transaction } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";

interface ExistingSocialMediaRow {
	id: string;
	position: number;
	socialMediaId: string;
}

interface SocialMediaSyncPlan {
	positionUpdates: Array<{ id: string; position: number }>;
	rowIdsToDelete: Array<string>;
	rowsToInsert: Array<{ position: number; socialMediaId: string }>;
}

/**
 * Diff existing join rows against the submitted, ordered social-media ids. `position` is the id's
 * index in the submitted array, so a user-defined order round-trips. Surviving rows whose index
 * changed get a position update; rows are diffed rather than replaced so `created_at` is
 * preserved.
 */
function planSocialMediaSync(
	existing: Array<ExistingSocialMediaRow>,
	submittedSocialMediaIds: Array<string>,
): SocialMediaSyncPlan {
	const existingBySocialMediaId = new Map(existing.map((row) => [row.socialMediaId, row] as const));
	const submitted = new Set(submittedSocialMediaIds);

	const rowIdsToDelete = existing
		.filter((row) => !submitted.has(row.socialMediaId))
		.map((row) => row.id);

	const rowsToInsert = submittedSocialMediaIds.flatMap((socialMediaId, position) =>
		existingBySocialMediaId.has(socialMediaId) ? [] : [{ position, socialMediaId }],
	);

	const positionUpdates = submittedSocialMediaIds.flatMap((socialMediaId, position) => {
		const row = existingBySocialMediaId.get(socialMediaId);
		return row != null && row.position !== position ? [{ id: row.id, position }] : [];
	});

	return { positionUpdates, rowIdsToDelete, rowsToInsert };
}

/** Reconcile a project version's social-media links, persisting the submitted order as `position`. */
export async function syncProjectSocialMedia(
	tx: Transaction,
	projectVersionId: string,
	socialMediaIds: Array<string>,
): Promise<void> {
	const existing = await tx
		.select({
			id: schema.projectsToSocialMedia.id,
			position: schema.projectsToSocialMedia.position,
			socialMediaId: schema.projectsToSocialMedia.socialMediaId,
		})
		.from(schema.projectsToSocialMedia)
		.where(eq(schema.projectsToSocialMedia.projectId, projectVersionId));

	const { positionUpdates, rowIdsToDelete, rowsToInsert } = planSocialMediaSync(
		existing,
		socialMediaIds,
	);

	await Promise.all([
		rowIdsToDelete.length > 0
			? tx
					.delete(schema.projectsToSocialMedia)
					.where(inArray(schema.projectsToSocialMedia.id, rowIdsToDelete))
			: Promise.resolve(),
		rowsToInsert.length > 0
			? tx.insert(schema.projectsToSocialMedia).values(
					rowsToInsert.map((row) => {
						return {
							position: row.position,
							projectId: projectVersionId,
							socialMediaId: row.socialMediaId,
						};
					}),
				)
			: Promise.resolve(),
		...positionUpdates.map((update) =>
			tx
				.update(schema.projectsToSocialMedia)
				.set({ position: update.position })
				.where(eq(schema.projectsToSocialMedia.id, update.id)),
		),
	]);
}

/** Reconcile an organisational-unit version's social-media links, persisting order as `position`. */
export async function syncOrganisationalUnitSocialMedia(
	tx: Transaction,
	unitVersionId: string,
	socialMediaIds: Array<string>,
): Promise<void> {
	const existing = await tx
		.select({
			id: schema.organisationalUnitsToSocialMedia.id,
			position: schema.organisationalUnitsToSocialMedia.position,
			socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId,
		})
		.from(schema.organisationalUnitsToSocialMedia)
		.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, unitVersionId));

	const { positionUpdates, rowIdsToDelete, rowsToInsert } = planSocialMediaSync(
		existing,
		socialMediaIds,
	);

	await Promise.all([
		rowIdsToDelete.length > 0
			? tx
					.delete(schema.organisationalUnitsToSocialMedia)
					.where(inArray(schema.organisationalUnitsToSocialMedia.id, rowIdsToDelete))
			: Promise.resolve(),
		rowsToInsert.length > 0
			? tx.insert(schema.organisationalUnitsToSocialMedia).values(
					rowsToInsert.map((row) => {
						return {
							organisationalUnitId: unitVersionId,
							position: row.position,
							socialMediaId: row.socialMediaId,
						};
					}),
				)
			: Promise.resolve(),
		...positionUpdates.map((update) =>
			tx
				.update(schema.organisationalUnitsToSocialMedia)
				.set({ position: update.position })
				.where(eq(schema.organisationalUnitsToSocialMedia.id, update.id)),
		),
	]);
}
