"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardFundingCallDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "funding_calls" },
	revalidate: "/[locale]/dashboard/website/funding-calls",
	redirect: "/dashboard/website/funding-calls",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, fundingCallsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
