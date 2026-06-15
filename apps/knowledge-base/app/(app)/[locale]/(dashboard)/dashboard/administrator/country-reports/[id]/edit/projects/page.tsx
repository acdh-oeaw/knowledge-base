import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportProjectsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-projects-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportProjectsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/projects"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportProjectsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report project contributions"),
	});
}

export default async function DashboardAdministratorCountryReportProjectsPage(
	props: Readonly<DashboardAdministratorCountryReportProjectsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportProjectsScreen reportId={id} />;
}
