import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportExternalResourcesSnapshotSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-external-resources-snapshot-section";
import { getAuthorizedWorkingGroupReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { refreshWorkingGroupReportExternalResourceSnapshotAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/refresh-working-group-report-external-resource-snapshot.action";
import { isReportEditable } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getWorkingGroupExternalResourceSnapshot } from "@/lib/data/report-marketplace-resources";
import { db } from "@/lib/db";

interface WorkingGroupReportSoftwareScreenProps {
	reportId: string;
}

export async function WorkingGroupReportSoftwareScreen(
	props: Readonly<WorkingGroupReportSoftwareScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;
	const { user } = await assertAuthenticated();
	const result = await getAuthorizedWorkingGroupReportForUser(
		user,
		reportId,
		(id) =>
			db.query.workingGroupReports.findFirst({
				where: { id },
				columns: { id: true },
			}),
		"update",
	);

	if (result.status !== "ok" || result.data == null) {
		notFound();
	}

	const report = result.data;
	const snapshot = await getWorkingGroupExternalResourceSnapshot(
		report.id,
		"working_group_sshoc_resources",
	);
	const t = await getExtracted();
	const canRefresh = await isReportEditable(user, {
		type: "working_group_report",
		id: report.id,
	});

	return (
		<ReportExternalResourcesSnapshotSection
			canRefresh={canRefresh}
			capturedAt={snapshot?.capturedAt.toISOString() ?? null}
			capturedByUserName={snapshot?.capturedByUserName ?? null}
			description={t(
				"Stored SSH Open Marketplace resources for this report. Refresh to capture the current search-index results.",
			)}
			emptyMessage={
				snapshot == null
					? t("No SSH Open Marketplace resources snapshot has been captured yet.")
					: t("No SSH Open Marketplace resources recorded for this snapshot.")
			}
			items={snapshot?.items ?? []}
			refreshAction={refreshWorkingGroupReportExternalResourceSnapshotAction}
			reportId={report.id}
			reportIdFieldName="workingGroupReportId"
			section="working_group_sshoc_resources"
			title={t("SSHOC resources")}
		/>
	);
}
