"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { resolveEntityDocumentLabel } from "@/lib/data/audit-log";
import { deleteAllDocumentVersions } from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import {
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
} from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const deleteNewsItemAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "delete", subjectType: "news" },
	revalidate: "/[locale]/dashboard/website/news",

	async mutate(tx, [documentId]: [string]) {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});
		assert(entity, "Document not found.");

		// Snapshot the label before deletion so the audit log doesn't fall back to the uuid.
		const subjectLabel = await resolveEntityDocumentLabel(tx, documentId);

		const descriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		await deleteAllDocumentVersions(tx, documentId, newsLifecycleAdapter);

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

		return {
			subjectId: documentId,
			subjectLabel,
			descriptor,
		};
	},

	async postCommit({ result }) {
		if (result.descriptor != null) {
			await deleteWebsiteDocument(result.descriptor);
		}
		await dispatchWebhook({ tags: ["news"] });
	},
});
