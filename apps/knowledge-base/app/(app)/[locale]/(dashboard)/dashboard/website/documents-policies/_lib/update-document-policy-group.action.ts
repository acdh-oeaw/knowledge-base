"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateDocumentPolicyGroupActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-policy-group.schema";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateDocumentPolicyGroupAction = createMutationAction({
	schema: UpdateDocumentPolicyGroupActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",

	async mutate(tx, input) {
		await tx
			.update(schema.documentPolicyGroups)
			.set({ label: input.label })
			.where(eq(schema.documentPolicyGroups.id, input.id));

		return { subjectId: input.id };
	},
});
