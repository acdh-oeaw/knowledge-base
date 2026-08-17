"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateWorkingGroupReportActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-group-reports/_lib/update-working-group-report.schema";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateWorkingGroupReportAction = createMutationAction({
	schema: UpdateWorkingGroupReportActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "working_group_reports" },
	revalidate: "/[locale]/dashboard/administrator/working-group-reports",
	redirect: "/dashboard/administrator/working-group-reports",

	async mutate(tx, input) {
		await tx
			.update(schema.workingGroupReports)
			.set({ status: input.status })
			.where(eq(schema.workingGroupReports.id, input.id));

		return { subjectId: input.id };
	},
});
