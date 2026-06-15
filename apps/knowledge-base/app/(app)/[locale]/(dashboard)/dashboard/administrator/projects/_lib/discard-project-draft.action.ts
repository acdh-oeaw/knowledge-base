"use server";

import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const discardProjectDraftAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "discard_draft", subjectType: "projects" },
	revalidate: "/[locale]/dashboard/administrator/projects",
	redirect: "/dashboard/administrator/projects",

	async mutate(tx, [documentId]: [string]) {
		await discardDraftVersion(tx, documentId, projectsLifecycleAdapter);
		return { subjectId: documentId };
	},
});
