"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { impactCaseStudiesLifecycleAdapter } from "@/lib/data/impact-case-studies.lifecycle-adapter";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const publishImpactCaseStudyAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "impact_case_studies" },
	revalidate: "/[locale]/dashboard/website/impact-case-studies",
	redirect: "/dashboard/website/impact-case-studies",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, impactCaseStudiesLifecycleAdapter);
		return { subjectId: documentId };
	},

	async postCommit({ result }) {
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "impact-case-studies" });
	},
});
