"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardNewsItemDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "news" },
	revalidate: "/[locale]/dashboard/website/news",
	redirect: "/dashboard/website/news",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, newsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
