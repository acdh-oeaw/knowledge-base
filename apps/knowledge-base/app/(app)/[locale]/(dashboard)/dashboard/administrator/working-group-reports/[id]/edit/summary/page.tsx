import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportSummaryScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-summary-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportSummaryPageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportSummaryPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report summary"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportSummaryPage(
	props: Readonly<DashboardAdministratorWorkingGroupReportSummaryPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <WorkingGroupReportSummaryScreen reportId={id} />;
}
