"use server";

import { getExtracted } from "next-intl/server";

import { RefreshWorkingGroupReportExternalResourceSnapshotActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/refresh-working-group-report-external-resource-snapshot.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import {
	type ReportExternalResourceSnapshotSection,
	refreshWorkingGroupExternalResourceSnapshot,
} from "@/lib/data/report-marketplace-resources";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { createMutationAction } from "@/lib/server/create-mutation-action";

function getSuccessMessage(
	t: Awaited<ReturnType<typeof getExtracted>>,
	section: ReportExternalResourceSnapshotSection,
): string {
	switch (section) {
		case "working_group_sshoc_resources": {
			return t("SSHOC resources snapshot refreshed.");
		}
		case "working_group_zotero_publications": {
			return t("Zotero publications snapshot refreshed.");
		}
		case "country_sshoc_resources":
		case "country_zotero_publications": {
			return t("External resources snapshot refreshed.");
		}
	}

	return t("External resources snapshot refreshed.");
}

export const refreshWorkingGroupReportExternalResourceSnapshotAction = createMutationAction({
	schema: RefreshWorkingGroupReportExternalResourceSnapshotActionInputSchema,
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

	async mutate(tx, input, ctx) {
		const t = await getExtracted();
		await refreshWorkingGroupExternalResourceSnapshot(tx, {
			capturedByUserId: ctx.user.id,
			section: input.section,
			workingGroupReportId: input.workingGroupReportId,
		});

		return {
			subjectId: input.workingGroupReportId,
			successMessage: getSuccessMessage(t, input.section),
		};
	},
});
