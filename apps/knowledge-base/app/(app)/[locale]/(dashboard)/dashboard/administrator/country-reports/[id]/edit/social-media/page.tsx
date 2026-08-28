import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportSocialMediaScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-social-media-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportSocialMediaPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit/social-media"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportSocialMediaPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report social media KPIs"),
	});
}

export default async function DashboardAdministratorCountryReportSocialMediaPage(
	props: Readonly<DashboardAdministratorCountryReportSocialMediaPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportSocialMediaScreen reportId={id} />;
}
