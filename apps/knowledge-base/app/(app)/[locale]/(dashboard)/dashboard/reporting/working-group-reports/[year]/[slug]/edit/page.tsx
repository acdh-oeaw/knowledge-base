import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { redirect } from "@/lib/navigation/navigation";

interface DashboardReportingEditWorkingGroupReportPageProps extends PageProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit"> {}

export default async function DashboardReportingEditWorkingGroupReportPage(
	props: Readonly<DashboardReportingEditWorkingGroupReportPageProps>,
): Promise<never> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}
	const locale = await getLocale();

	redirect({
		href: `/dashboard/reporting/working-group-reports/${routeYear}/${slug}/edit/summary`,
		locale,
	});
}
