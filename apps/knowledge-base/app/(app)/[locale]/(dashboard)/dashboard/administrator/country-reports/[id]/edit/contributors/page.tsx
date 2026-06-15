import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportContributorsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-contributors-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportContributorsPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/contributors"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportContributorsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report contributors"),
	});
}

export default async function DashboardAdministratorCountryReportContributorsPage(
	props: Readonly<DashboardAdministratorCountryReportContributorsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportContributorsScreen reportId={id} />;
}
