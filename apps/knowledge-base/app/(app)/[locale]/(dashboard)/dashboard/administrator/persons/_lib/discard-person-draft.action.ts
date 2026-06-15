"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardPersonDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "persons" },
	revalidate: "/[locale]/dashboard/administrator/persons",
	redirect: "/dashboard/administrator/persons",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, personsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
