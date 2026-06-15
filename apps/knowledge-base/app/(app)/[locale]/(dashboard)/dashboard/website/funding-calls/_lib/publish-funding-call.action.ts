"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishFundingCallAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "funding_calls" },
	revalidate: "/[locale]/dashboard/website/funding-calls",
	redirect: "/dashboard/website/funding-calls",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, fundingCallsLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "funding-calls" });
	},
});
