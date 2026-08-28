import { getLocale } from "next-intl/server";

import { redirect } from "@/lib/navigation/navigation";

interface DashboardReportingWorkingGroupReportConfirmPageProps {
	params: Promise<{ year: string; slug: string }>;
}

export default async function DashboardReportingWorkingGroupReportConfirmPage(
	props: Readonly<DashboardReportingWorkingGroupReportConfirmPageProps>,
): Promise<never> {
	const { params } = props;

	const { year, slug } = await params;
	const locale = await getLocale();

	redirect({
		href: `/dashboard/reporting/working-group-reports/${year}/${slug}/edit/summary`,
		locale,
	});
}
