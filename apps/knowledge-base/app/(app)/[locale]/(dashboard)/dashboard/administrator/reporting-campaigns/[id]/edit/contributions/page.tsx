import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignContributionAmountsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-contribution-amounts-form";
import { upsertCampaignContributionAmountsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-contribution-amounts.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignContributionAmountsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCampaignContributionsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit/contributions"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCampaignContributionsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Campaign contribution amounts"),
	});
}

export default async function DashboardAdministratorCampaignContributionsPage(
	props: Readonly<DashboardAdministratorCampaignContributionsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const campaign = await getReportingCampaignContributionAmountsForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<CampaignContributionAmountsForm
			amounts={campaign.contributionAmounts}
			campaignId={id}
			formAction={upsertCampaignContributionAmountsAction}
		/>
	);
}
