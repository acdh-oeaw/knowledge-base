import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportDataScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-data-screen";
import {
	getWorkingGroupReportEditHref,
	resolveWorkingGroupReportId,
} from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingWorkingGroupReportDataPageProps extends PageProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit/data"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingWorkingGroupReportDataPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group report data"),
	});
}

export default async function DashboardReportingWorkingGroupReportDataPage(
	props: Readonly<DashboardReportingWorkingGroupReportDataPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return (
		<WorkingGroupReportDataScreen
			basePath={getWorkingGroupReportEditHref(Number(routeYear), slug)}
			reportId={id}
		/>
	);
}
