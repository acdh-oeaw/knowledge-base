"use server";

import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { CreateWorkingGroupReportEventActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/create-working-group-report-event.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createWorkingGroupReportEventAction = createMutationAction({
	schema: CreateWorkingGroupReportEventActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "working_group_report" },
	revalidate: workingGroupReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", {
			type: "working_group_report",
			id: input.workingGroupReportId,
		});
		await assertReportEditable(ctx.user, {
			type: "working_group_report",
			id: input.workingGroupReportId,
		});
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx.insert(schema.workingGroupReportEvents).values({
			workingGroupReportId: input.workingGroupReportId,
			title: input.title,
			date: input.date,
			url: input.url ?? null,
			role: input.role,
		});

		return { subjectId: input.workingGroupReportId, successMessage: t("Added.") };
	},
});
