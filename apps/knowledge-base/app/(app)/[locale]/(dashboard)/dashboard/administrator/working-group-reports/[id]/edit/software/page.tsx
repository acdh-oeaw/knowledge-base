import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportSoftwareScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-software-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportSoftwarePageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit/software"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportSoftwarePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report SSHOC resources"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportSoftwarePage(
	props: Readonly<DashboardAdministratorWorkingGroupReportSoftwarePageProps>,
): Promise<ReactNode> {
	const { id } = await props.params;

	return <WorkingGroupReportSoftwareScreen reportId={id} />;
}
