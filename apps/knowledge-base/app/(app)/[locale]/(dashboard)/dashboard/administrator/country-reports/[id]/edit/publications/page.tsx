import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportPublicationsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-publications-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportPublicationsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/publications"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportPublicationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report publications"),
	});
}

export default async function DashboardAdministratorCountryReportPublicationsPage(
	props: Readonly<DashboardAdministratorCountryReportPublicationsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportPublicationsScreen reportId={id} />;
}
