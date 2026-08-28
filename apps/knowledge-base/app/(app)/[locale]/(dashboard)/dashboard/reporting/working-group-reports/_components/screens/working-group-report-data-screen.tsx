import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { WorkingGroupReportChairsSnapshotForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-chairs-snapshot-form";
import { WorkingGroupReportDataForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-data-form";
import { WorkingGroupReportSocialMediaForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-social-media-form";
import { createWorkingGroupReportSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/create-working-group-report-social-media.action";
import { deleteWorkingGroupReportSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/delete-working-group-report-social-media.action";
import { getAuthorizedWorkingGroupReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { refreshWorkingGroupReportChairsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/refresh-working-group-report-chairs.action";
import { updateWorkingGroupReportDataAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/update-working-group-report-data.action";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getWorkingGroupChairCandidates,
	getWorkingGroupChairSnapshotDrift,
	getWorkingGroupReportChairs,
} from "@/lib/data/working-group-report-chairs";
import { db } from "@/lib/db";

interface WorkingGroupReportDataScreenProps {
	reportId: string;
}

/** Shared "data" screen. See {@link getAuthorizedWorkingGroupReportForUser} for authorization. */
export async function WorkingGroupReportDataScreen(
	props: Readonly<WorkingGroupReportDataScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedWorkingGroupReportForUser(
		user,
		reportId,
		(id) =>
			db.query.workingGroupReports.findFirst({
				where: { id },
				columns: {
					id: true,
					numberOfMembers: true,
					workingGroupDocumentId: true,
					campaignId: true,
				},
				with: {
					campaign: { columns: { year: true } },
					socialMedia: {
						columns: { id: true, socialMediaId: true },
						with: {
							socialMedia: { columns: { id: true, name: true, url: true } },
						},
					},
					workingGroup: {
						columns: { id: true },
						with: {
							socialMedia: { columns: { id: true, name: true, url: true } },
						},
					},
				},
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report?.workingGroup == null) {
		notFound();
	}

	const { year } = report.campaign;

	const [storedChairs, currentChairs] = await Promise.all([
		getWorkingGroupReportChairs(report.id),
		getWorkingGroupChairCandidates(report.workingGroupDocumentId, year),
	]);
	const { chairs, missing: missingChairs } = getWorkingGroupChairSnapshotDrift(
		storedChairs,
		currentChairs,
	);

	const t = await getExtracted();

	const claimedSocialMediaIds = new Set(report.socialMedia.map((s) => s.socialMediaId));
	const availableSocialMedia = report.workingGroup.socialMedia.filter(
		(s) => !claimedSocialMediaIds.has(s.id),
	);

	return (
		<div className="flex flex-col gap-y-12">
			<section className="flex flex-col gap-y-4">
				<h2 className="text-sm font-semibold text-fg">{t("Working group data")}</h2>
				<WorkingGroupReportDataForm
					formAction={updateWorkingGroupReportDataAction}
					report={report}
				/>
			</section>

			<WorkingGroupReportChairsSnapshotForm
				canManageRelations={user.role === "admin"}
				chairs={chairs}
				missing={missingChairs}
				refreshAction={refreshWorkingGroupReportChairsAction}
				workingGroupReportId={report.id}
			/>

			<WorkingGroupReportSocialMediaForm
				addAction={createWorkingGroupReportSocialMediaAction}
				availableSocialMedia={availableSocialMedia}
				deleteAction={deleteWorkingGroupReportSocialMediaAction}
				report={{
					id: report.id,
					socialMedia: report.socialMedia,
				}}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="working_group"
				screenKey="data"
			/>
		</div>
	);
}
