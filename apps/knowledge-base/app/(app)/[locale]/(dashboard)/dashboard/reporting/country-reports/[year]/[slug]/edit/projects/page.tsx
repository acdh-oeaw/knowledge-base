import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportProjectsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-projects-screen";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportProjectsPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit/projects"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportProjectsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country report project contributions"),
	});
}

export default async function DashboardReportingCountryReportProjectsPage(
	props: Readonly<DashboardReportingCountryReportProjectsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <CountryReportProjectsScreen reportId={id} />;
}
