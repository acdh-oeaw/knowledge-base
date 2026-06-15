import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportingStatisticsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-statistics-page";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { getReportingStatisticsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorReportingStatisticsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-statistics"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorReportingStatisticsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Reporting statistics"),
	});

	return metadata;
}

export default async function DashboardAdministratorReportingStatisticsPage(
	props: Readonly<DashboardAdministratorReportingStatisticsPageProps>,
): Promise<ReactNode> {
	const { searchParams } = props;
	const rawSearchParams = await searchParams;
	const { user } = await assertAdminPageAccess();
	const campaignYearValue = rawSearchParams.campaignYear;
	const countryNameValue = rawSearchParams.country;
	const campaignYear =
		typeof campaignYearValue === "string" && campaignYearValue !== ""
			? Number.parseInt(campaignYearValue, 10)
			: undefined;
	const countryName =
		typeof countryNameValue === "string" && countryNameValue !== "" ? countryNameValue : undefined;
	const data = await getReportingStatisticsForAdmin(user, {
		campaignYear: Number.isNaN(campaignYear) ? undefined : campaignYear,
		countryName,
	});

	return (
		<ReportingStatisticsPage
			data={data}
			filters={{
				campaignYear:
					typeof campaignYearValue === "string" && campaignYearValue !== ""
						? campaignYearValue
						: "",
				countryName: typeof countryNameValue === "string" ? countryNameValue : "",
			}}
		/>
	);
}
