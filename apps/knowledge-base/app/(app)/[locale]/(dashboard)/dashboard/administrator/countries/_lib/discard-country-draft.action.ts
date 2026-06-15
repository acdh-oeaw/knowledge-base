"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardCountryDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "countries" },
	revalidate: "/[locale]/dashboard/administrator/countries",
	redirect: "/dashboard/administrator/countries",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
