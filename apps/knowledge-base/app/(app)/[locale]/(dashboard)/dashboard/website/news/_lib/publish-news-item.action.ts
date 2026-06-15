"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishNewsItemAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "news" },
	revalidate: "/[locale]/dashboard/website/news",
	redirect: "/dashboard/website/news",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, newsLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "news" });
	},
});
