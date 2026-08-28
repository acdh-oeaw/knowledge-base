"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateDocumentPolicyGroupActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-policy-group.schema";
import { eq, sql } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createDocumentPolicyGroupAction = createMutationAction({
	schema: CreateDocumentPolicyGroupActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",

	async mutate(tx, input) {
		// Group ordering is global. Serialize writers so concurrent admin/e2e requests cannot assign
		// the same position, and normalize legacy duplicates before appending the new group.
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('document_policy_groups_order'))`);
		const existing = await tx
			.select({
				id: schema.documentPolicyGroups.id,
				position: schema.documentPolicyGroups.position,
			})
			.from(schema.documentPolicyGroups)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label);

		for (const [position, group] of existing.entries()) {
			if (group.position !== position) {
				await tx
					.update(schema.documentPolicyGroups)
					.set({ position })
					.where(eq(schema.documentPolicyGroups.id, group.id));
			}
		}

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
