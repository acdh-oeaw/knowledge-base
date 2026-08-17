import { Button } from "@dariah-eric/ui/button";
import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportSummary } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-summary";
import { confirmCountryReportAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/confirm-country-report.action";
import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { submitCountryReportAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/submit-country-report.action";
import { can } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";

interface CountryReportConfirmScreenProps {
	reportId: string;
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Shared "confirm" screen (reporting flow). See {@link getCountryReportDataForUser} for
 * authorization.
 */
export async function CountryReportConfirmScreen(
	props: Readonly<CountryReportConfirmScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getCountryReportDataForUser(user, reportId, "update");

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;

	const t = await getExtracted();
	const canConfirm = await can(user, "confirm", { type: "country_report", id: reportId });

	return (
		<div className="flex flex-col gap-y-10">
			<CountryReportSummary data={report.summary} />

			<div className="border-bs pbs-6 flex flex-col gap-y-4">
				<div className="space-y-1">
					<p className="text-sm font-medium text-fg">{t("Status")}</p>
					<p className="text-sm text-muted-fg">{formatStatus(report.status)}</p>
				</div>

				<div className="flex flex-wrap gap-3">
					{report.status === "draft" && report.campaign.status === "open" && (
						<form action={submitCountryReportAction}>
							<input name="id" type="hidden" value={report.id} />
							<Button type="submit">{t("Submit report")}</Button>
						</form>
					)}

					{canConfirm && report.status === "submitted" && (
						<form action={confirmCountryReportAction}>
							<input name="id" type="hidden" value={report.id} />
							<Button type="submit">{t("Accept report")}</Button>
						</form>
					)}

					{report.status === "accepted" && (
						<p className="text-sm text-muted-fg">{t("This report has been accepted.")}</p>
					)}

					<a
						className={buttonStyles({ intent: "plain", size: "sm" })}
						download={`country-report-${reportId}.json`}
						href={`/api/reporting/country-reports/${reportId}/download`}
					>
						<ArrowDownTrayIcon className="me-2 block-4 inline-4" />
						{t("Download JSON")}
					</a>
				</div>
			</div>

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="confirm" />
		</div>
	);
}
