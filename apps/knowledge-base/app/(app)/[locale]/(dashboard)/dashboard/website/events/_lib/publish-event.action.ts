"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishEventAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "events" },
	revalidate: "/[locale]/dashboard/website/events",
	redirect: "/dashboard/website/events",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, eventsLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "events" });
	},
});
