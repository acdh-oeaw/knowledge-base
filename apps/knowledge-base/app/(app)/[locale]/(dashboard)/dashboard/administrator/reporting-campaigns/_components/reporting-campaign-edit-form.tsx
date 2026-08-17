"use client";

import type * as schema from "@dariah-eric/database/schema";
import { Heading } from "@dariah-eric/ui/heading";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { ReportingCampaignForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/reporting-campaign-form";
import { updateReportingCampaignAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/update-reporting-campaign.action";

interface ReportingCampaignEditFormProps {
	campaign: Pick<schema.ReportingCampaign, "id" | "year" | "status">;
}

export function ReportingCampaignEditForm(
	props: Readonly<ReportingCampaignEditFormProps>,
): ReactNode {
	const { campaign } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<Heading>{t("Edit reporting campaign")}</Heading>

			<ReportingCampaignForm campaign={campaign} formAction={updateReportingCampaignAction} />
		</Fragment>
	);
}
