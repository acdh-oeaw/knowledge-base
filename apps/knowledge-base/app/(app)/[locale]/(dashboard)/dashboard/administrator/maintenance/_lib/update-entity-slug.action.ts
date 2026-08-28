"use server";

import { updateEntitySlug } from "@/lib/data/entity-merge";
import {
	type WebsiteDocumentDescriptor,
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
	syncWebsiteDocumentForEntity,
} from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhookForEntityType } from "@/lib/webhook/dispatch-webhook";

interface UpdateEntitySlugResult {
	subjectId: string;
	/** The entity's website document under its previous slug — removed after the slug changes. */
	previousDescriptor: WebsiteDocumentDescriptor | null;
	entityType: string;
	slugChanged: boolean;
	auditSummary: Record<string, unknown>;
}

export const updateEntitySlugAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "update", subjectType: "entities" },
	revalidate: "/[locale]/dashboard/administrator/maintenance",

	async mutate(tx, [documentId, slug]: [string, string]): Promise<UpdateEntitySlugResult> {
		// Capture the pre-change website document (read outside the tx, so it still reflects the old
		// slug) so we can drop the stale `type:slug` entry once the new slug commits.
		const previousDescriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		const entity = await updateEntitySlug(tx, documentId, slug);
		const slugChanged = previousDescriptor?.slug !== entity.slug;

		return {
			subjectId: documentId,
			previousDescriptor,
			entityType: entity.type,
			slugChanged,
			auditSummary: { slug: entity.slug, previousSlug: previousDescriptor?.slug },
		};
	},

	async postCommit({ result }) {
		if (result.slugChanged && result.previousDescriptor != null) {
			await deleteWebsiteDocument(result.previousDescriptor);
		}
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhookForEntityType(
			result.entityType as Parameters<typeof dispatchWebhookForEntityType>[0],
		);
	},
});
