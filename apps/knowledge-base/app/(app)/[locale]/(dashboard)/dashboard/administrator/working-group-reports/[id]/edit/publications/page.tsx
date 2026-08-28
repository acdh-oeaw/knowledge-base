import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportPublicationsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-publications-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportPublicationsPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit/publications"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportPublicationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report publications"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportPublicationsPage(
	props: Readonly<DashboardAdministratorWorkingGroupReportPublicationsPageProps>,
): Promise<ReactNode> {
	const { id } = await props.params;

	return <WorkingGroupReportPublicationsScreen reportId={id} />;
}
