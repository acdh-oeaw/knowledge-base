import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportQuestionsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-questions-screen";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorWorkingGroupReportQuestionsPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/[id]/edit/questions"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorWorkingGroupReportQuestionsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Working group report questions"),
	});
}

export default async function DashboardAdministratorWorkingGroupReportQuestionsPage(
	props: Readonly<DashboardAdministratorWorkingGroupReportQuestionsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	return (
		<WorkingGroupReportQuestionsScreen
			basePath={`/dashboard/administrator/working-group-reports/${id}/edit`}
			reportId={id}
		/>
	);
}
