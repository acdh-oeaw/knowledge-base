"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardEventDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "events" },
	revalidate: "/[locale]/dashboard/website/events",
	redirect: "/dashboard/website/events",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, eventsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
