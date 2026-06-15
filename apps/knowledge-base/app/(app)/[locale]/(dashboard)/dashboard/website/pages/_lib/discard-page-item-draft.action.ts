"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { pagesLifecycleAdapter } from "@/lib/data/pages.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardPageItemDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "pages" },
	revalidate: "/[locale]/dashboard/website/pages",
	redirect: "/dashboard/website/pages",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, pagesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
