"use client";

import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import {
	type ReportStep,
	ReportStepTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-step-tabs";

interface CountryReportStepNavProps {
	/** The `/edit` base path; per-screen routes are appended to it. */
	editBasePath: string;
	/**
	 * - `reporting`: the user-facing flow.
	 * - `admin`: starts with a "Status" tab (status editor at the edit index) and has no confirm step.
	 */
	variant: "admin" | "reporting";
}

export function CountryReportStepNav(props: Readonly<CountryReportStepNavProps>): ReactNode {
	const { editBasePath, variant } = props;

	const t = useExtracted();

	const steps: Array<ReportStep> = [
		...(variant === "admin" ? [{ href: editBasePath, label: t("Status") }] : []),
		{ href: `${editBasePath}/contributors`, label: t("Contributors") },
		{ href: `${editBasePath}/institutions`, label: t("Institutions") },
		{ href: `${editBasePath}/events`, label: t("Events") },
		{ href: `${editBasePath}/social-media`, label: t("Social media") },
		{ href: `${editBasePath}/services`, label: t("Services") },
		{ href: `${editBasePath}/software`, label: t("SSHOC resources") },
		{ href: `${editBasePath}/publications`, label: t("Publications") },
		{ href: `${editBasePath}/projects`, label: t("Projects") },
		{ href: `${editBasePath}/summary`, label: t("Summary") },
	];

	return <ReportStepTabs aria-label={t("Report sections")} steps={steps} />;
}
