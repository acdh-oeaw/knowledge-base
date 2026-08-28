import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportPublicationsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-publications-screen";
import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingWorkingGroupReportPublicationsPageProps extends PageProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit/publications"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingWorkingGroupReportPublicationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group report publications"),
	});
}

export default async function DashboardReportingWorkingGroupReportPublicationsPage(
	props: Readonly<DashboardReportingWorkingGroupReportPublicationsPageProps>,
): Promise<ReactNode> {
	const { year: routeYear, slug } = await props.params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <WorkingGroupReportPublicationsScreen reportId={id} />;
}
