"use client";

import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import {
	type ReportStep,
	ReportStepTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-step-tabs";

interface CampaignStepNavProps {
	campaignId: string;
}

export function CampaignStepNav(props: Readonly<CampaignStepNavProps>): ReactNode {
	const { campaignId } = props;

	const t = useExtracted();

	const base = `/dashboard/administrator/reporting-campaigns/${campaignId}/edit`;

	const steps: Array<ReportStep> = [
		{ href: `${base}/settings`, label: t("Settings") },
		{ href: `${base}/events`, label: t("Events") },
		{ href: `${base}/social-media`, label: t("Social media") },
		{ href: `${base}/contributions`, label: t("Contributions") },
		{ href: `${base}/services`, label: t("Services") },
		{ href: `${base}/countries`, label: t("Countries") },
		{ href: `${base}/questions`, label: t("Questions") },
	];

	return <ReportStepTabs aria-label={t("Campaign sections")} steps={steps} />;
}
