"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { CreateWorkingGroupReportSocialMediaActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/create-working-group-report-social-media.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createWorkingGroupReportSocialMediaAction = createMutationAction({
	schema: CreateWorkingGroupReportSocialMediaActionInputSchema,
	requireAuth: true,
	audit: { action: "create", subjectType: "working_group_report" },
	revalidate: workingGroupReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		const t = await getExtracted();
		await assertCan(ctx.user, "update", {
			type: "working_group_report",
			id: input.workingGroupReportId,
		});
		await assertReportEditable(ctx.user, {
			type: "working_group_report",
			id: input.workingGroupReportId,
		});

		const existing = await db.query.workingGroupReportSocialMedia.findFirst({
			where: {
				workingGroupReportId: input.workingGroupReportId,
				socialMediaId: input.socialMediaId,
			},
			columns: { id: true },
		});

		if (existing != null) {
			return createActionStateError({ message: t("This account is already listed.") });
		}

		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		await tx.insert(schema.workingGroupReportSocialMedia).values({
			workingGroupReportId: input.workingGroupReportId,
			socialMediaId: input.socialMediaId,
		});

		return { subjectId: input.workingGroupReportId, successMessage: t("Added.") };
	},
});
