import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportEventsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-events-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportEventsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/events"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportEventsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report events"),
	});
}

export default async function DashboardAdministratorCountryReportEventsPage(
	props: Readonly<DashboardAdministratorCountryReportEventsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportEventsScreen reportId={id} />;
}
