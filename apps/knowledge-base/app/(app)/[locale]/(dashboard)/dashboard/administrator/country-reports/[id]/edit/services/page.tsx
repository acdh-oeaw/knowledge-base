import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportServicesScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-services-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportServicesPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/services"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportServicesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report service KPIs"),
	});
}

export default async function DashboardAdministratorCountryReportServicesPage(
	props: Readonly<DashboardAdministratorCountryReportServicesPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return (
		<CountryReportServicesScreen
			basePath={`/dashboard/administrator/country-reports/${id}/edit`}
			reportId={id}
		/>
	);
}
