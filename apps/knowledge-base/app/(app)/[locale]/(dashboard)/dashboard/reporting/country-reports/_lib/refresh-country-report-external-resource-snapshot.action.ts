"use server";

import { getExtracted } from "next-intl/server";

import { RefreshCountryReportExternalResourceSnapshotActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-external-resource-snapshot.schema";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import {
	type ReportExternalResourceSnapshotSection,
	refreshCountryExternalResourceSnapshot,
} from "@/lib/data/report-marketplace-resources";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { createMutationAction } from "@/lib/server/create-mutation-action";

function getSuccessMessage(
	t: Awaited<ReturnType<typeof getExtracted>>,
	section: ReportExternalResourceSnapshotSection,
): string {
	switch (section) {
		case "country_sshoc_resources": {
			return t("SSHOC resources snapshot refreshed.");
		}
		case "country_zotero_publications": {
			return t("Zotero publications snapshot refreshed.");
		}
		case "working_group_sshoc_resources":
		case "working_group_zotero_publications": {
			return t("External resources snapshot refreshed.");
		}
	}

	return t("External resources snapshot refreshed.");
}

export const refreshCountryReportExternalResourceSnapshotAction = createMutationAction({
	schema: RefreshCountryReportExternalResourceSnapshotActionInputSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "country_report" },
	revalidate: countryReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "country_report", id: input.countryReportId });
		await assertReportEditable(ctx.user, { type: "country_report", id: input.countryReportId });
		return undefined;
	},

	async mutate(tx, input, ctx) {
		const t = await getExtracted();
		await refreshCountryExternalResourceSnapshot(tx, {
			capturedByUserId: ctx.user.id,
			countryReportId: input.countryReportId,
			section: input.section,
		});

		return {
			subjectId: input.countryReportId,
			successMessage: getSuccessMessage(t, input.section),
		};
	},
});
