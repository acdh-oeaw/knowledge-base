import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportContributorsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-contributors-screen";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportContributorsPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit/contributors"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportContributorsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country report contributors"),
	});
}

export default async function DashboardReportingCountryReportContributorsPage(
	props: Readonly<DashboardReportingCountryReportContributorsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <CountryReportContributorsScreen reportId={id} />;
}
