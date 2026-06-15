"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardSpotlightArticleDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "spotlight_articles" },
	revalidate: "/[locale]/dashboard/website/spotlight-articles",
	redirect: "/dashboard/website/spotlight-articles",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, spotlightArticlesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
