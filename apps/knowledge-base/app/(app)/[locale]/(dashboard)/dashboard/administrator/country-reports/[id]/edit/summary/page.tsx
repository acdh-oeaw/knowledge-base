import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportSummaryScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-summary-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportSummaryPageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportSummaryPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report summary"),
	});
}

export default async function DashboardAdministratorCountryReportSummaryPage(
	props: Readonly<DashboardAdministratorCountryReportSummaryPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <CountryReportSummaryScreen reportId={id} />;
}
