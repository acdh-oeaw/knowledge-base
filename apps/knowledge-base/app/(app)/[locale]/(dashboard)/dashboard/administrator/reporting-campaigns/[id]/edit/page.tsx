import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { redirect } from "@/lib/navigation/navigation";

interface DashboardAdministratorEditReportingCampaignPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit"> {}

export default async function DashboardAdministratorEditReportingCampaignPage(
	props: Readonly<DashboardAdministratorEditReportingCampaignPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const locale = await getLocale();

	redirect({ href: `/dashboard/administrator/reporting-campaigns/${id}/edit/settings`, locale });
}
