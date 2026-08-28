import * as schema from "@dariah-eric/database/schema";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportingKpisPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-kpis-page";
import { ReportingStatisticsShell } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_components/reporting-statistics-shell";
import { getKpiSearchParam } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_lib/kpi-search-params";
import { getStatisticsFilters } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-statistics/_lib/statistics-filters";
import { dashboardPageSize } from "@/config/pagination.config";
import { assertAdminPageAccess } from "@/lib/auth/session";
import {
	type ReportingKpiSort,
	getReportingServiceKpisForAdmin,
	getReportingStatisticsFilterOptionsForAdmin,
} from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";
import { getListSearchParams, getListSortSearchParams } from "@/lib/server/list-search-params";

interface DashboardAdministratorReportingStatisticsServicesPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-statistics/services"> {}

const pageSize = dashboardPageSize;
const defaultSort = "campaignYear" satisfies ReportingKpiSort;
const validSorts = [
	"campaignYear",
	"country",
	"entity",
	"kpi",
	"value",
] satisfies ReadonlyArray<ReportingKpiSort>;

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorReportingStatisticsServicesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Reported service KPIs"),
	});

	return metadata;
}

export default async function DashboardAdministratorReportingStatisticsServicesPage(
	props: Readonly<DashboardAdministratorReportingStatisticsServicesPageProps>,
): Promise<ReactNode> {
	const { searchParams } = props;
	const rawSearchParams = await searchParams;
	const { page, q } = getListSearchParams(rawSearchParams);
	const { dir, sort } = getListSortSearchParams(rawSearchParams, {
		defaultDir: "desc",
		defaultSort,
		validSorts,
	});
	const kpi = getKpiSearchParam(rawSearchParams, schema.serviceKpiCategoryEnum);
	const { user } = await assertAdminPageAccess();
	const t = await getExtracted();
	const [filterOptions, kpis] = await Promise.all([
		getReportingStatisticsFilterOptionsForAdmin(user),
		getReportingServiceKpisForAdmin(user, {
			...getStatisticsFilters(rawSearchParams),
			dir,
			kpi,
			limit: pageSize,
			offset: (page - 1) * pageSize,
			q,
			sort,
		}),
	]);

	return (
		<ReportingStatisticsShell filterOptions={filterOptions}>
			<ReportingKpisPage
				description={t(
					"See which country reported which service in which campaign year, and the values behind each KPI.",
				)}
				dir={dir}
				entityColumnLabel={t("Service")}
				entitySearchPlaceholder={t("Search by service")}
				kpi={kpi ?? ""}
				kpiOptions={schema.serviceKpiCategoryEnum}
				kpis={kpis}
				page={page}
				q={q}
				sort={sort}
				title={t("Reported service KPIs")}
			/>
		</ReportingStatisticsShell>
	);
}
