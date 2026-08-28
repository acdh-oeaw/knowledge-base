"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { getExtracted } from "next-intl/server";

import { RefreshWorkingGroupReportChairsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/refresh-working-group-report-chairs.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { getWorkingGroupChairCandidates } from "@/lib/data/working-group-report-chairs";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

/** Replaces a report's stored chair snapshot with the currently active chair relations. */
export const refreshWorkingGroupReportChairsAction = createMutationAction({
	schema: RefreshWorkingGroupReportChairsActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "working_group_report" },
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
		const report = await tx.query.workingGroupReports.findFirst({
			where: { id: input.workingGroupReportId },
			columns: { workingGroupDocumentId: true },
			with: { campaign: { columns: { year: true } } },
		});
		assert(report, "Working group report not found.");

		const candidates = await getWorkingGroupChairCandidates(
			report.workingGroupDocumentId,
			report.campaign.year,
			tx,
		);

		await tx
			.delete(schema.workingGroupReportChairs)
			.where(eq(schema.workingGroupReportChairs.workingGroupReportId, input.workingGroupReportId));

		if (candidates.length > 0) {
			await tx.insert(schema.workingGroupReportChairs).values(
				candidates.map((candidate) => {
					return {
						workingGroupReportId: input.workingGroupReportId,
						personToOrgUnitId: candidate.personToOrgUnitId,
						chairRole: candidate.chairRole,
					};
				}),
			);
		}

		return {
			subjectId: input.workingGroupReportId,
			successMessage: t("Chairs updated from current relations."),
		};
	},
});
