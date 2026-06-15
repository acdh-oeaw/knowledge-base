"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { ReportingCampaignForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/reporting-campaign-form";
import { createReportingCampaignAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/create-reporting-campaign.action";

export function ReportingCampaignCreateForm(): ReactNode {
	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New reporting campaign")} />

			<ReportingCampaignForm formAction={createReportingCampaignAction} />
		</Fragment>
	);
}
