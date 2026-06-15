import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportEventsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-events-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportEventsPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit/events"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportEventsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report events"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportEventsPage(
	props: Readonly<DashboardAdministratorWorkingGroupReportEventsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return <WorkingGroupReportEventsScreen reportId={id} />;
}
