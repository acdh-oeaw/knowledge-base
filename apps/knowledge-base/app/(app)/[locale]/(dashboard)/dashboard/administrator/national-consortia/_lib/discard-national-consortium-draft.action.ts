"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardNationalConsortiumDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "national_consortia" },
	revalidate: "/[locale]/dashboard/administrator/national-consortia",
	redirect: "/dashboard/administrator/national-consortia",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
