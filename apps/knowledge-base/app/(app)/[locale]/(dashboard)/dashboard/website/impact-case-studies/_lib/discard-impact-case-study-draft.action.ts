"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { impactCaseStudiesLifecycleAdapter } from "@/lib/data/impact-case-studies.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardImpactCaseStudyDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "impact_case_studies" },
	revalidate: "/[locale]/dashboard/website/impact-case-studies",
	redirect: "/dashboard/website/impact-case-studies",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, impactCaseStudiesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
