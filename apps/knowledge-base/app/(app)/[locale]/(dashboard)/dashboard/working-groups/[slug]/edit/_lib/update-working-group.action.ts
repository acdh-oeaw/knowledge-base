"use server";

import { getExtracted } from "next-intl/server";

import { UpdateWorkingGroupActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/update-working-group.schema";
import { assertCan } from "@/lib/auth/permissions";
import { updateManagedOrganisationalUnitDraft } from "@/lib/data/update-managed-organisational-unit";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateDelegatedWorkingGroupAction = createMutationAction({
	schema: UpdateWorkingGroupActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "working_groups" },
	revalidate: "/[locale]/dashboard/working-groups",
	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "organisational_unit", id: input.documentId });
	},
	async mutate(tx, input) {
		const t = await getExtracted();
		await updateManagedOrganisationalUnitDraft(tx, input);
		return {
			subjectId: input.documentId,
			auditSummary: { lifecycle: "draft" },
			successMessage: t("Working group saved as draft."),
		};
	},
});
