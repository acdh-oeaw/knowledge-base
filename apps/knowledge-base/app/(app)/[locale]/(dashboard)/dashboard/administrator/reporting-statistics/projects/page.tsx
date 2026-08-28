import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportingProjectContributionsPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-project-contributions-page";
import { ReportingStatisticsShell } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-statistics-shell";
import { getStatisticsFilters } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_lib/statistics-filters";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAdminPageAccess } from "@/lib/auth/session";
import {
	type ReportingProjectContributionsSort,
	getReportingProjectContributionsForAdmin,
	getReportingStatisticsFilterOptionsForAdmin,
} from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";
import { getListSearchParams, getListSortSearchParams } from "@/lib/server/list-search-params";

interface DashboardAdministratorReportingStatisticsProjectsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-statistics/projects"> {}

const pageSize = dashboardPageSize;
const defaultSort = "campaignYear" satisfies ReportingProjectContributionsSort;
const validSorts = [
	"amount",
	"campaignYear",
	"country",
	"project",
] satisfies ReadonlyArray<ReportingProjectContributionsSort>;

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorReportingStatisticsProjectsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Reported project contributions"),
	});

	return metadata;
}

export default async function DashboardAdministratorReportingStatisticsProjectsPage(
	props: Readonly<DashboardAdministratorReportingStatisticsProjectsPageProps>,
): Promise<ReactNode> {
	const { searchParams } = props;
	const rawSearchParams = await searchParams;
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const { user } = await assertAdminPageAccess();
	const [filterOptions, contributions] = await Promise.all([
		getReportingStatisticsFilterOptionsForAdmin(user),
		getReportingProjectContributionsForAdmin(user, {
			...getStatisticsFilters(rawSearchParams),
			dir,
			limit: pageSize,
			offset: (page - 1) * pageSize,
			q,
			sort,
		}),
	]);

	return (
		<ReportingStatisticsShell filterOptions={filterOptions}>
			<ReportingProjectContributionsPage
				contributions={contributions}
				dir={dir}
				page={page}
				q={q}
				sort={sort}
			/>
		</ReportingStatisticsShell>
	);
}
