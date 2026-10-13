"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { resolveEntityDocumentLabel } from "@/lib/data/audit-log";
import {
	assertDocumentNotLinkedToUser,
	deleteAllDocumentVersions,
	deleteDocumentRelations,
} from "@/lib/data/entity-lifecycle";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import {
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
} from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const deleteProjectAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "delete", subjectType: "projects" },
	revalidate: "/[locale]/dashboard/administrator/projects",

	async mutate(tx, [documentId]: [string]) {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});
		assert(entity, "Document not found.");

		await assertDocumentNotLinkedToUser(tx, documentId);

		// Snapshot the label before deletion so the audit log doesn't fall back to the uuid.
		const subjectLabel = await resolveEntityDocumentLabel(tx, documentId);

		const descriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		await deleteAllDocumentVersions(tx, documentId, projectsLifecycleAdapter);

		// Document-level relations have no ON DELETE CASCADE; remove them before the entity row.
		await deleteDocumentRelations(tx, documentId);

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
		await dispatchWebhook({ type: "dariah-projects" });
	},
});
