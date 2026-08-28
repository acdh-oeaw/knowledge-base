import { getLocale } from "next-intl/server";

import { redirect } from "@/lib/navigation/navigation";

interface DashboardReportingCountryReportConfirmPageProps {
	params: Promise<{ year: string; slug: string }>;
}

export default async function DashboardReportingCountryReportConfirmPage(
	props: Readonly<DashboardReportingCountryReportConfirmPageProps>,
): Promise<never> {
	const { params } = props;

	const { year, slug } = await params;
	const locale = await getLocale();

	redirect({
		href: `/dashboard/reporting/country-reports/${year}/${slug}/edit/summary`,
		locale,
	});
}
