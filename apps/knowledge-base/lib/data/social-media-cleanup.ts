import {
	type DeleteUnusedSocialMediaResult,
	type UnusedSocialMedia,
	type UnusedSocialMediaResult,
	deleteUnusedSocialMedia as deleteUnusedSocialMediaShared,
	findUnusedSocialMedia,
} from "@dariah-eric/database/social-media-cleanup-service";

import { db } from "@/lib/db";

export type { DeleteUnusedSocialMediaResult, UnusedSocialMedia, UnusedSocialMediaResult };

/**
 * Dry run: lists social-media entries not referenced by any record, so an administrator can review
 * them before removing. See {@link findUnusedSocialMedia} for how "unused" is determined.
 */
export async function getUnusedSocialMedia(): Promise<UnusedSocialMediaResult> {
	return findUnusedSocialMedia(db);
}

/**
 * Removes the given unused social-media entries, delegating to the shared implementation (the same
 * one the `@dariah-eric/maintenance` cli uses) so the definition of "unused" and the delete/audit
 * behaviour never diverge.
 */
export async function deleteUnusedSocialMedia(
	ids: Array<string>,
	actorUserId: string | null,
): Promise<DeleteUnusedSocialMediaResult> {
	return deleteUnusedSocialMediaShared(db, ids, { actorUserId });
}
