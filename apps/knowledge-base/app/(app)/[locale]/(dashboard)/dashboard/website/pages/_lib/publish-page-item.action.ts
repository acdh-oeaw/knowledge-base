"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { pagesLifecycleAdapter } from "@/lib/data/pages.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishPageItemAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "pages" },
	revalidate: "/[locale]/dashboard/website/pages",
	redirect: "/dashboard/website/pages",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, pagesLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "pages" });
	},
});
