import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportingStatisticsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-statistics-page";
import { ReportingStatisticsShell } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-statistics-shell";
import { getStatisticsFilters } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_lib/statistics-filters";
import { assertAdminPageAccess } from "@/lib/auth/session";
import {
	getReportingStatisticsFilterOptionsForAdmin,
	getReportingStatisticsForAdmin,
} from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorReportingStatisticsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-statistics"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorReportingStatisticsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Reporting statistics"),
	});

	return metadata;
}

export default async function DashboardAdministratorReportingStatisticsPage(
	props: Readonly<DashboardAdministratorReportingStatisticsPageProps>,
): Promise<ReactNode> {
	const { searchParams } = props;
	const rawSearchParams = await searchParams;
	const { user } = await assertAdminPageAccess();
	const [filterOptions, data] = await Promise.all([
		getReportingStatisticsFilterOptionsForAdmin(user),
		getReportingStatisticsForAdmin(user, getStatisticsFilters(rawSearchParams)),
	]);

	return (
		<ReportingStatisticsShell filterOptions={filterOptions}>
			<ReportingStatisticsPage data={data} />
		</ReportingStatisticsShell>
	);
}
