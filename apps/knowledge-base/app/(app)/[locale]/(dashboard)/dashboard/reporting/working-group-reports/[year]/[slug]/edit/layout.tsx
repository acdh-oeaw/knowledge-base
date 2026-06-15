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
import { getWorkingGroupReportHeaderForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getWorkingGroupReportEditHref,
	resolveWorkingGroupReportId,
} from "@/lib/data/reporting-urls";

interface WorkingGroupReportEditLayoutProps extends LayoutProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit"> {}

export default async function WorkingGroupReportEditLayout(
	props: Readonly<WorkingGroupReportEditLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	const { user } = await assertAuthenticated();
	const result = await getWorkingGroupReportHeaderForUser(user, id, "update");

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle>{report.workingGroup.name}</HeaderTitle>
					<HeaderDescription>
						{"Campaign "}
						{report.campaign.year}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-6 px-(--layout-padding) pbs-6">
				<ReportEditGuard>
					<WorkingGroupReportStepNav
						editBasePath={getWorkingGroupReportEditHref(Number(routeYear), slug)}
						variant="reporting"
					/>
					{children}
				</ReportEditGuard>
			</div>
		</div>
	);
}
