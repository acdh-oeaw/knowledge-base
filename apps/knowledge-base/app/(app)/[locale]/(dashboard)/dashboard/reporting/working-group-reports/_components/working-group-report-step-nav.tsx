"use client";

import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import {
	type ReportStep,
	ReportStepTabs,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-step-tabs";

interface WorkingGroupReportStepNavProps {
	/** The `/edit` base path; per-screen routes are appended to it. */
	editBasePath: string;
	/**
	 * - `reporting`: the user-facing flow — ends with a "Confirm" step.
	 * - `admin`: starts with a "Status" tab (status editor at the edit index) and has no confirm step.
	 */
	variant: "admin" | "reporting";
}

export function WorkingGroupReportStepNav(
	props: Readonly<WorkingGroupReportStepNavProps>,
): ReactNode {
	const { editBasePath, variant } = props;

	const t = useExtracted();

	const steps: Array<ReportStep> = [
		...(variant === "admin" ? [{ href: editBasePath, label: t("Status") }] : []),
		{ href: `${editBasePath}/data`, label: t("Data") },
		{ href: `${editBasePath}/events`, label: t("Events") },
		{ href: `${editBasePath}/questions`, label: t("Questions") },
		...(variant === "reporting" ? [{ href: `${editBasePath}/confirm`, label: t("Confirm") }] : []),
	];

	return <ReportStepTabs aria-label={t("Report sections")} steps={steps} />;
}
