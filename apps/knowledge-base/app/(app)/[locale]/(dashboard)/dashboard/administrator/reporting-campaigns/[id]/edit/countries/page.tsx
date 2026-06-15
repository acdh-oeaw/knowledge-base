import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignCountryThresholdsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-country-thresholds-form";
import { upsertCampaignCountryThresholdsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/upsert-campaign-country-thresholds.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignCountryThresholdsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCampaignCountriesPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit/countries"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCampaignCountriesPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Campaign country thresholds"),
	});
}

export default async function DashboardAdministratorCampaignCountriesPage(
	props: Readonly<DashboardAdministratorCampaignCountriesPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const { campaign, countries } = await getReportingCampaignCountryThresholdsForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<CampaignCountryThresholdsForm
			campaignId={id}
			countries={countries}
			formAction={upsertCampaignCountryThresholdsAction}
			thresholds={campaign.countryThresholds}
		/>
	);
}
