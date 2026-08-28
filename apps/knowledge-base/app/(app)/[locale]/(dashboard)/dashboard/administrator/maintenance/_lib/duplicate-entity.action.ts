"use server";

import { duplicateEntity } from "@/lib/data/entity-duplicate";
import { createCommandAction } from "@/lib/server/create-command-action";

interface DuplicateEntityActionResult {
	subjectId: string;
	auditSummary: Record<string, unknown>;
}

/**
 * There is no `postCommit` fan-out here, unlike `mergeEntitiesAction`: the clone is a draft-only
 * document, so it has no published version to index on the website and nothing public changed for a
 * webhook to announce. Both happen through the normal publish flow once an admin renames the
 * clone.
 */
export const duplicateEntityAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "create", subjectType: "entities" },
	revalidate: [
		"/[locale]/dashboard/administrator/maintenance",
		// The clone surfaces on the drafts page, which is where the UI sends the admin next.
		"/[locale]/dashboard/administrator/drafts",
	],

	async mutate(
		tx,
		[sourceId, slug]: [string, string | undefined],
	): Promise<DuplicateEntityActionResult> {
		const result = await duplicateEntity(tx, sourceId, slug);

		return {
			// The clone is the thing that was created, so it is the audit subject; its label resolves
			// live from the draft version.
			subjectId: result.cloneId,
			auditSummary: {
				sourceId: result.sourceId,
				cloneId: result.cloneId,
				type: result.type,
				slug: result.slug,
			},
		};
	},
});
