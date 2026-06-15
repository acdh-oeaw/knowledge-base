import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { ReportEditGuard } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-edit-guard";
import { WorkingGroupReportStepNav } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-report-step-nav";
import { assertAuthenticated } from "@/lib/auth/session";
import { getWorkingGroupReportForAdmin } from "@/lib/data/admin-reporting";

interface DashboardAdministratorWorkingGroupReportEditLayoutProps extends LayoutProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit"> {}

export default async function DashboardAdministratorWorkingGroupReportEditLayout(
	props: Readonly<DashboardAdministratorWorkingGroupReportEditLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const report = await getWorkingGroupReportForAdmin(user, id);

	if (report == null) {
		notFound();
	}

	const t = await getExtracted();

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle className="leading-tight">{report.workingGroup.name}</HeaderTitle>
					<HeaderDescription>
						{t("Campaign {year}", { year: String(report.campaign.year) })}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-6 px-(--layout-padding) pbs-6">
				<ReportEditGuard>
					<WorkingGroupReportStepNav
						editBasePath={`/dashboard/administrator/working-group-reports/${id}/edit`}
						variant="admin"
					/>
					{children}
				</ReportEditGuard>
			</div>
		</div>
	);
}
