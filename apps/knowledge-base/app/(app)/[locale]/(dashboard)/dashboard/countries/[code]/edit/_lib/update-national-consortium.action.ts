"use server";

/** Delegated country-dashboard update; publishing remains admin-only. */

import { getExtracted } from "next-intl/server";

import { UpdateNationalConsortiumActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/national-consortia/_lib/update-national-consortium.schema";
import { assertCan } from "@/lib/auth/permissions";
import { updateManagedOrganisationalUnitDraft } from "@/lib/data/update-managed-organisational-unit";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateDelegatedNationalConsortiumAction = createMutationAction({
	schema: UpdateNationalConsortiumActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "national_consortia" },
	revalidate: "/[locale]/dashboard/countries",
	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "organisational_unit", id: input.documentId });
	},
	async mutate(tx, input) {
		const t = await getExtracted();
		await updateManagedOrganisationalUnitDraft(tx, input);
		return {
			subjectId: input.documentId,
			auditSummary: { lifecycle: "draft" },
			successMessage: t("National consortium saved as draft."),
		};
	},
});
