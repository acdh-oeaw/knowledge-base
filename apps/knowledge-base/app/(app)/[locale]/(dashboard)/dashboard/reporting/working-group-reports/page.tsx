import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { WorkingGroupReportsListPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/working-group-reports-list-page";
import { assertAuthenticated } from "@/lib/auth/session";
import { getUserAllWorkingGroupReports } from "@/lib/data/reporting";
import { createMetadata } from "@/lib/server/create-metadata";

export async function generateMetadata(
	_props: Readonly<Record<string, never>>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group reports"),
	});

	return metadata;
}

export default async function DashboardReportingWorkingGroupReportsPage(): Promise<ReactNode> {
	const { user } = await assertAuthenticated();

	const reports = await getUserAllWorkingGroupReports(user);

	return <WorkingGroupReportsListPage reports={reports} />;
}
