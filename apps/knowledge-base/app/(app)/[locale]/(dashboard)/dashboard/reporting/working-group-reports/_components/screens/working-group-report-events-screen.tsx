import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { WorkingGroupReportEventsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-events-form";
import { createWorkingGroupReportEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/create-working-group-report-event.action";
import { deleteWorkingGroupReportEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/delete-working-group-report-event.action";
import { getAuthorizedWorkingGroupReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

interface WorkingGroupReportEventsScreenProps {
	reportId: string;
}

/** Shared "events" screen. See {@link getAuthorizedWorkingGroupReportForUser} for authorization. */
export async function WorkingGroupReportEventsScreen(
	props: Readonly<WorkingGroupReportEventsScreenProps>,
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
				with: {
					events: {
						columns: { id: true, title: true, date: true, url: true, role: true },
						orderBy: { date: "asc" },
					},
				},
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	return (
		<div className="flex flex-col gap-y-12">
			<WorkingGroupReportEventsForm
				addAction={createWorkingGroupReportEventAction}
				deleteAction={deleteWorkingGroupReportEventAction}
				report={report}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="working_group"
				screenKey="events"
			/>
		</div>
	);
}
