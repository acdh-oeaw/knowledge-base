import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignEventAmountsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-event-amounts-form";
import { upsertCampaignEventAmountsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-event-amounts.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignEventAmountsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCampaignEventsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit/events"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCampaignEventsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Campaign event amounts"),
	});
}

export default async function DashboardAdministratorCampaignEventsPage(
	props: Readonly<DashboardAdministratorCampaignEventsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const campaign = await getReportingCampaignEventAmountsForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<CampaignEventAmountsForm
			amounts={campaign.eventAmounts}
			campaignId={id}
			formAction={upsertCampaignEventAmountsAction}
		/>
	);
}
