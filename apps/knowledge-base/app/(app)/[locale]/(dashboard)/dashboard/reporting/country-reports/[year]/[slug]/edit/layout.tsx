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
import { getCountryReportHeaderForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportEditHref, resolveCountryReportId } from "@/lib/data/reporting-urls";

interface CountryReportEditLayoutProps extends LayoutProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit"> {}

export default async function CountryReportEditLayout(
	props: Readonly<CountryReportEditLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	const { user } = await assertAuthenticated();
	const result = await getCountryReportHeaderForUser(user, id, "update");

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle>{report.country.name}</HeaderTitle>
					<HeaderDescription>
						{"Campaign "}
						{report.campaign.year}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-6 px-(--layout-padding) pbs-6">
				<ReportEditGuard>
					<CountryReportStepNav
						editBasePath={getCountryReportEditHref(Number(routeYear), slug)}
						variant="reporting"
					/>
					{children}
				</ReportEditGuard>
			</div>
		</div>
	);
}
