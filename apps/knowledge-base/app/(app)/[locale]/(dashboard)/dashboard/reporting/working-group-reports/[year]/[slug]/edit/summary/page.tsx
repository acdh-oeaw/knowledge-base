import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportSummaryScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-summary-screen";
import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingWorkingGroupReportSummaryPageProps {
	params: Promise<{ year: string; slug: string }>;
}

export async function generateMetadata(
	_props: Readonly<DashboardReportingWorkingGroupReportSummaryPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group report summary"),
	});
}

export default async function DashboardReportingWorkingGroupReportSummaryPage(
	props: Readonly<DashboardReportingWorkingGroupReportSummaryPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <WorkingGroupReportSummaryScreen reportId={id} />;
}
