"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardGovernanceBodyDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "governance_bodies" },
	revalidate: "/[locale]/dashboard/administrator/governance-bodies",
	redirect: "/dashboard/administrator/governance-bodies",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
