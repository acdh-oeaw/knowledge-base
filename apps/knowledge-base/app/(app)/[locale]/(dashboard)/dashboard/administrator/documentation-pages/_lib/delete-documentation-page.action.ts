"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { resolveEntityDocumentLabel } from "@/lib/data/audit-log";
import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { deleteAllDocumentVersions } from "@/lib/data/entity-lifecycle";
import { eq } from "@/lib/db/sql";
import { createCommandAction } from "@/lib/server/create-command-action";

export const deleteDocumentationPageAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "delete", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",

	async mutate(tx, [documentId]: [string]) {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});
		assert(entity, "Document not found.");

		// Snapshot the label before deletion so the audit log doesn't fall back to the uuid.
		const subjectLabel = await resolveEntityDocumentLabel(tx, documentId);

		await deleteAllDocumentVersions(tx, documentId, documentationPagesLifecycleAdapter);

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

		return { subjectId: documentId, subjectLabel };
	},
});
