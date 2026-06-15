import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { redirect } from "@/lib/navigation/navigation";

interface DashboardReportingEditCountryReportPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]/edit"> {}

export default async function DashboardReportingEditCountryReportPage(
	props: Readonly<DashboardReportingEditCountryReportPageProps>,
): Promise<never> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}
	const locale = await getLocale();

	redirect({
		href: `/dashboard/reporting/country-reports/${routeYear}/${slug}/edit/institutions`,
		locale,
	});
}
