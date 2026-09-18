"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { opportunitiesLifecycleAdapter } from "@/lib/data/opportunities.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishOpportunityAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "opportunities" },
	revalidate: "/[locale]/dashboard/website/opportunities",
	redirect: "/dashboard/website/opportunities",

	async mutate(tx, [documentId, localeId]: [string, string?]) {
		await publishVersion(tx, documentId, opportunitiesLifecycleAdapter, localeId);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ tags: ["opportunities"] });
	},
});
