"use server";

import { publishVersion } from "@/lib/data/entity-lifecycle";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { createCommandAction } from "@/lib/server/create-command-action";

export const publishInternalPageAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "publish", subjectType: "internal_pages" },
	revalidate: "/[locale]/dashboard/administrator/internal-pages",
	redirect: "/dashboard/administrator/internal-pages",

	async mutate(tx, [documentId]: [string]) {
		await publishVersion(tx, documentId, internalPagesLifecycleAdapter);
		return { subjectId: documentId };
	},
});
