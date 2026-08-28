import {
	type DeleteEmptyContentBlocksResult,
	type EmptyContentBlock,
	type EmptyContentBlocksResult,
	deleteEmptyContentBlocks as deleteEmptyContentBlocksShared,
	findEmptyContentBlocks,
} from "@dariah-eric/database/content-block-cleanup-service";

import { db } from "@/lib/db";

export type { DeleteEmptyContentBlocksResult, EmptyContentBlock, EmptyContentBlocksResult };

/**
 * Dry run: lists semantically empty `rich_text` content blocks so an administrator can review them
 * before removing. See {@link findEmptyContentBlocks} for how "empty" is determined.
 */
export async function getEmptyContentBlocks(): Promise<EmptyContentBlocksResult> {
	return findEmptyContentBlocks(db);
}

/**
 * Removes the given empty content blocks, delegating to the shared implementation (the same one the
 * `@dariah-eric/maintenance` cli uses) so the definition of "empty" and the delete/audit behaviour
 * never diverge.
 */
export async function deleteEmptyContentBlocks(
	ids: Array<string>,
	actorUserId: string | null,
): Promise<DeleteEmptyContentBlocksResult> {
	return deleteEmptyContentBlocksShared(db, ids, { actorUserId });
}
