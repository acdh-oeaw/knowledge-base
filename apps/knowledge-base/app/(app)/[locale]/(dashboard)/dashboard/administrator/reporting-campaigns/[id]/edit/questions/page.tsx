import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CampaignQuestionsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_components/campaign-questions-form";
import { createWorkingGroupReportQuestionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/create-working-group-report-question.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { getReportingCampaignQuestionsForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCampaignQuestionsPageProps extends PageProps<"/[locale]/dashboard/administrator/reporting-campaigns/[id]/edit/questions"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCampaignQuestionsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Campaign questions"),
	});
}

export default async function DashboardAdministratorCampaignQuestionsPage(
	props: Readonly<DashboardAdministratorCampaignQuestionsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const campaign = await getReportingCampaignQuestionsForAdmin(user, id);

	if (campaign == null) {
		notFound();
	}

	return (
		<CampaignQuestionsForm
			campaignId={id}
			createAction={createWorkingGroupReportQuestionAction}
			questions={campaign.workingGroupReportQuestions}
		/>
	);
}
