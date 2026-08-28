import {
	type CleanRichTextResult,
	type RichTextCleanupBlock,
	type RichTextCleanupResult,
	cleanRichText as cleanRichTextShared,
	findRichTextNeedingCleanup,
} from "@dariah-eric/database/richtext-cleanup-service";

import { db } from "@/lib/db";

export type { CleanRichTextResult, RichTextCleanupBlock, RichTextCleanupResult };

/**
 * Dry run: lists rich-text content blocks (and accordion items) that normalisation would tidy, so
 * an administrator can review them before rewriting. See {@link findRichTextNeedingCleanup}.
 */
export async function getRichTextNeedingCleanup(): Promise<RichTextCleanupResult> {
	return findRichTextNeedingCleanup(db);
}

/**
 * Rewrites the given content blocks with their normalised rich text, delegating to the shared
 * implementation (the same one the `@dariah-eric/maintenance` cli uses) so normalisation and audit
 * behaviour never diverge.
 */
export async function cleanRichText(
	ids: Array<string>,
	actorUserId: string | null,
): Promise<CleanRichTextResult> {
	return cleanRichTextShared(db, ids, { actorUserId });
}
