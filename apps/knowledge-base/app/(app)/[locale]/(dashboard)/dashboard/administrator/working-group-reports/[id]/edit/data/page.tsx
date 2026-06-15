import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportDataScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-data-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportDataPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit/data"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportDataPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report data"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportDataPage(
	props: Readonly<DashboardAdministratorWorkingGroupReportDataPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return (
		<WorkingGroupReportDataScreen
			basePath={`/dashboard/administrator/working-group-reports/${id}/edit`}
			reportId={id}
		/>
	);
}
