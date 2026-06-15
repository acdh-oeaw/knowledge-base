"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishGovernanceBodyAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "governance_bodies" },
	revalidate: "/[locale]/dashboard/administrator/governance-bodies",
	redirect: "/dashboard/administrator/governance-bodies",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "governance-bodies" });
	},
});
