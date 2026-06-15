import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-group-reports/_components/working-group-report-create-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getWorkingGroupReportCreateDataForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateWorkingGroupReportPageProps extends PageProps<"/[locale]/dashboard/administrator/working-group-reports/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateWorkingGroupReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - New working group report"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateWorkingGroupReportPage(
	_props: Readonly<DashboardAdministratorCreateWorkingGroupReportPageProps>,
): Promise<ReactNode> {
	const { user } = await assertAuthenticated();
	const { campaigns, workingGroups } = await getWorkingGroupReportCreateDataForAdmin(user);

	return <WorkingGroupReportCreateForm campaigns={campaigns} workingGroups={workingGroups} />;
}
