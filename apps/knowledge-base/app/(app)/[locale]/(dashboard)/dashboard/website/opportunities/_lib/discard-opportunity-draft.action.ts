"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { opportunitiesLifecycleAdapter } from "@/lib/data/opportunities.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardOpportunityDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "opportunities" },
	revalidate: "/[locale]/dashboard/website/opportunities",
	redirect: "/dashboard/website/opportunities",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, opportunitiesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
