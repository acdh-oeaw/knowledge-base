"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardInternalPageDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "internal_pages" },
	revalidate: "/[locale]/dashboard/administrator/internal-pages",
	redirect: "/dashboard/administrator/internal-pages",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, internalPagesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
