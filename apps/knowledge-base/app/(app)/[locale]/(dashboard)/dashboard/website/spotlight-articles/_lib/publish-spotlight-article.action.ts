"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishSpotlightArticleAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "spotlight_articles" },
	revalidate: "/[locale]/dashboard/website/spotlight-articles",
	redirect: "/dashboard/website/spotlight-articles",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, spotlightArticlesLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "spotlight-articles" });
	},
});
