import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignSocialMediaAmountsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-social-media-amounts-form";
import { upsertCampaignSocialMediaAmountsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-social-media-amounts.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignSocialMediaAmountsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCampaignSocialMediaPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit/social-media"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCampaignSocialMediaPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Campaign social media amounts"),
	});
}

export default async function DashboardAdministratorCampaignSocialMediaPage(
	props: Readonly<DashboardAdministratorCampaignSocialMediaPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const campaign = await getReportingCampaignSocialMediaAmountsForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<CampaignSocialMediaAmountsForm
			amounts={campaign.socialMediaAmounts}
			campaignId={id}
			formAction={upsertCampaignSocialMediaAmountsAction}
		/>
	);
}
