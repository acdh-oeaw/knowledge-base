"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateDocumentPolicyGroupActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-policy-group.schema";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createDocumentPolicyGroupAction = createMutationAction({
	schema: CreateDocumentPolicyGroupActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",

	async mutate(tx, input) {
		const existing = await tx.query.documentPolicyGroups.findMany({
			columns: { id: true },
		});

		const [created] = await tx
			.insert(schema.documentPolicyGroups)
			.values({
				label: input.label,
				position: existing.length,
			})
			.returning({ id: schema.documentPolicyGroups.id });

		assert(created);

		return { subjectId: created.id };
	},
});
