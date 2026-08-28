import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportSocialMediaScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/screens/country-report-social-media-screen";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportSocialMediaPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit/social-media"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportSocialMediaPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country report social media KPIs"),
	});
}

export default async function DashboardReportingCountryReportSocialMediaPage(
	props: Readonly<DashboardReportingCountryReportSocialMediaPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <CountryReportSocialMediaScreen reportId={id} />;
}
