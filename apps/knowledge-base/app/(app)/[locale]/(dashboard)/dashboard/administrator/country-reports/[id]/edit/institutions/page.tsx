import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportInstitutionsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-institutions-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportInstitutionsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/institutions"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportInstitutionsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report institutions"),
	});
}

export default async function DashboardAdministratorCountryReportInstitutionsPage(
	props: Readonly<DashboardAdministratorCountryReportInstitutionsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportInstitutionsScreen reportId={id} />;
}
