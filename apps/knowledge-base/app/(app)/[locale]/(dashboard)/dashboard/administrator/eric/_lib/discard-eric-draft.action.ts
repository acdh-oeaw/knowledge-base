"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardEricDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "eric" },
	revalidate: "/[locale]/dashboard/administrator/eric",
	redirect: "/dashboard/administrator/eric",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
