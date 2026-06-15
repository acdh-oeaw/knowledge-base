import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportConfirmScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-confirm-screen";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportConfirmPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit/confirm"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportConfirmPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Confirm country report"),
	});
}

export default async function DashboardReportingCountryReportConfirmPage(
	props: Readonly<DashboardReportingCountryReportConfirmPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <CountryReportConfirmScreen reportId={id} />;
}
