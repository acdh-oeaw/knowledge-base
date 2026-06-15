"use server";

import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { publishVersion } from "@/lib/data/entity-lifecycle";
import { createCommandAction } from "@/lib/server/create-command-action";

export const publishDocumentationPageAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",
	redirect: "/dashboard/administrator/documentation-pages",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, documentationPagesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
