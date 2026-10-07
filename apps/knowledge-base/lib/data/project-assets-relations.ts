import * as schema from "@dariah-eric/database/schema";

import type { Transaction } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";

interface ExistingProjectAssetRow {
	id: string;
	position: number;
	assetId: string;
}

interface ProjectAssetSyncPlan {
	positionUpdates: Array<{ id: string; position: number }>;
	rowIdsToDelete: Array<string>;
	rowsToInsert: Array<{ position: number; assetId: string }>;
}

/**
 * Diff existing join rows against the submitted, ordered asset ids. `position` is the id's index in
 * the submitted array, so a user-defined order round-trips. Surviving rows whose index changed get
 * a position update; rows are diffed rather than replaced so `created_at` is preserved.
 */
function planProjectAssetSync(
	existing: Array<ExistingProjectAssetRow>,
	submittedAssetIds: Array<string>,
): ProjectAssetSyncPlan {
	const existingByAssetId = new Map(existing.map((row) => [row.assetId, row] as const));
	const submitted = new Set(submittedAssetIds);

	const rowIdsToDelete = existing.filter((row) => !submitted.has(row.assetId)).map((row) => row.id);

	const rowsToInsert = submittedAssetIds.flatMap((assetId, position) =>
		existingByAssetId.has(assetId) ? [] : [{ position, assetId }],
	);

	const positionUpdates = submittedAssetIds.flatMap((assetId, position) => {
		const row = existingByAssetId.get(assetId);
		return row != null && row.position !== position ? [{ id: row.id, position }] : [];
	});

	return { positionUpdates, rowIdsToDelete, rowsToInsert };
}

/**
 * Reconcile a project version's additional-assets links, persisting the submitted order as
 * `position`.
 */
export async function syncProjectAssets(
	tx: Transaction,
	projectVersionId: string,
	assetIds: Array<string>,
): Promise<void> {
	const existing = await tx
		.select({
			id: schema.projectsToAssets.id,
			position: schema.projectsToAssets.position,
			assetId: schema.projectsToAssets.assetId,
		})
		.from(schema.projectsToAssets)
		.where(eq(schema.projectsToAssets.projectId, projectVersionId));

	const { positionUpdates, rowIdsToDelete, rowsToInsert } = planProjectAssetSync(
		existing,
		assetIds,
	);

	await Promise.all([
		rowIdsToDelete.length > 0
			? tx
					.delete(schema.projectsToAssets)
					.where(inArray(schema.projectsToAssets.id, rowIdsToDelete))
			: Promise.resolve(),
		rowsToInsert.length > 0
			? tx.insert(schema.projectsToAssets).values(
					rowsToInsert.map((row) => {
						return {
							position: row.position,
							projectId: projectVersionId,
							assetId: row.assetId,
						};
					}),
				)
			: Promise.resolve(),
		...positionUpdates.map((update) =>
			tx
				.update(schema.projectsToAssets)
				.set({ position: update.position })
				.where(eq(schema.projectsToAssets.id, update.id)),
		),
	]);
}
