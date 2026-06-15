"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishEricAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "eric" },
	revalidate: "/[locale]/dashboard/administrator/eric",
	redirect: "/dashboard/administrator/eric",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "members-partners" });
	},
});
