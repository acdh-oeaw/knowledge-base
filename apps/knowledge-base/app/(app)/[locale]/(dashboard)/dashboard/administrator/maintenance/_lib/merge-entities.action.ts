"use server";

import { mergeEntities } from "@/lib/data/entity-merge";
import {
	type WebsiteDocumentDescriptor,
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
	syncWebsiteDocumentForEntity,
} from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhookForEntityType } from "@/lib/webhook/dispatch-webhook";

interface MergeEntitiesActionResult {
	subjectId: string;
	targetId: string;
	entityType: string;
	/** The soon-to-be-deleted source's website document — removed after the merge commits. */
	sourceDescriptor: WebsiteDocumentDescriptor | null;
	auditSummary: Record<string, unknown>;
}

export const mergeEntitiesAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "delete", subjectType: "entities" },
	revalidate: "/[locale]/dashboard/administrator/maintenance",

	async mutate(tx, [sourceId, targetId]: [string, string]): Promise<MergeEntitiesActionResult> {
		// Capture the source's website document before it is deleted (read outside the tx).
		const sourceDescriptor = await getWebsiteDocumentDescriptorByEntityId(sourceId);

		const result = await mergeEntities(tx, sourceId, targetId);

		return {
			subjectId: sourceId,
			targetId: result.targetId,
			entityType: result.type,
			sourceDescriptor,
			auditSummary: { sourceId, targetId: result.targetId, type: result.type },
		};
	},

	async postCommit({ result }) {
		if (result.sourceDescriptor != null) {
			await deleteWebsiteDocument(result.sourceDescriptor);
		}
		await syncWebsiteDocumentForEntity(result.targetId);
		await dispatchWebhookForEntityType(
			result.entityType as Parameters<typeof dispatchWebhookForEntityType>[0],
		);
	},
});
