"use server";

import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardDocumentationPageDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",
	redirect: "/dashboard/administrator/documentation-pages",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, documentationPagesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
