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
import { CountryReportStepNav } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-step-nav";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportForAdmin } from "@/lib/data/admin-reporting";

interface DashboardAdministratorCountryReportEditLayoutProps extends LayoutProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit"> {}

export default async function DashboardAdministratorCountryReportEditLayout(
	props: Readonly<DashboardAdministratorCountryReportEditLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const report = await getCountryReportForAdmin(user, id);

	if (report == null) {
		notFound();
	}

	const t = await getExtracted();

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle className="leading-tight">{report.country.name}</HeaderTitle>
					<HeaderDescription>
						{t("Campaign {year}", { year: String(report.campaign.year) })}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-6 px-(--layout-padding) pbs-6">
				<ReportEditGuard>
					<CountryReportStepNav
						editBasePath={`/dashboard/administrator/country-reports/${id}/edit`}
						variant="admin"
					/>
					{children}
				</ReportEditGuard>
			</div>
		</div>
	);
}
