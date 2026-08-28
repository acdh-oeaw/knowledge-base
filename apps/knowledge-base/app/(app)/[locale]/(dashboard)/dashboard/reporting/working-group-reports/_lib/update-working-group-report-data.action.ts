"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { UpdateWorkingGroupReportDataActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/update-working-group-report-data.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateWorkingGroupReportDataAction = createMutationAction({
	schema: UpdateWorkingGroupReportDataActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "working_group_report" },
	revalidate: workingGroupReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "working_group_report", id: input.id });
		await assertReportEditable(ctx.user, { type: "working_group_report", id: input.id });
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx
			.update(schema.workingGroupReports)
			.set({
				numberOfMembers: input.numberOfMembers ?? null,
			})
			.where(eq(schema.workingGroupReports.id, input.id));

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
