import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportSoftwareScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-software-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportSoftwarePageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/software"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportSoftwarePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report SSHOC resources"),
	});
}

export default async function DashboardAdministratorCountryReportSoftwarePage(
	props: Readonly<DashboardAdministratorCountryReportSoftwarePageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportSoftwareScreen reportId={id} />;
}
