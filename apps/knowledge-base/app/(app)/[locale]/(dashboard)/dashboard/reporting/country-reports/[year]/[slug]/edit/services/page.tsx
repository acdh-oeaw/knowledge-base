import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportServicesScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-services-screen";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportServicesPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit/services"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportServicesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country report service KPIs"),
	});
}

export default async function DashboardReportingCountryReportServicesPage(
	props: Readonly<DashboardReportingCountryReportServicesPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <CountryReportServicesScreen reportId={id} />;
}
