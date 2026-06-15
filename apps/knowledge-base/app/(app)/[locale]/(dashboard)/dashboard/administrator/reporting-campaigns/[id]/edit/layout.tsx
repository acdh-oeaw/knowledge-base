import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { CampaignStepNav } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-step-nav";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignHeaderForAdmin } from "@/lib/data/admin-reporting";

interface CampaignEditLayoutProps extends LayoutProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit"> {}

export default async function CampaignEditLayout(
	props: Readonly<CampaignEditLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const campaign = await getReportingCampaignHeaderForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle>{"Campaign"}</HeaderTitle>
					<HeaderDescription>{campaign.year}</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-6 px-(--layout-padding) pbs-6">
				<CampaignStepNav campaignId={id} />
				{children}
			</div>
		</div>
	);
}
