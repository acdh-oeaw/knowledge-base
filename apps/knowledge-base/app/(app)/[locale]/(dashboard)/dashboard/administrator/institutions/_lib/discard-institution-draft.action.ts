"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardInstitutionDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "institutions" },
	revalidate: "/[locale]/dashboard/administrator/institutions",
	redirect: "/dashboard/administrator/institutions",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
