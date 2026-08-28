import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportExternalResourcesSnapshotSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-external-resources-snapshot-section";
import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { refreshCountryReportExternalResourceSnapshotAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-external-resource-snapshot.action";
import { isReportEditable } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryExternalResourceSnapshot } from "@/lib/data/report-marketplace-resources";
import { db } from "@/lib/db";

interface CountryReportPublicationsScreenProps {
	reportId: string;
}

/** Shared "publications" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportPublicationsScreen(
	props: Readonly<CountryReportPublicationsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				columns: { id: true },
			}),
		"update",
	);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;
	if (report == null) {
		notFound();
	}

	const t = await getExtracted();
	const canRefresh = await isReportEditable(user, { type: "country_report", id: report.id });
	const snapshot = await getCountryExternalResourceSnapshot(
		report.id,
		"country_zotero_publications",
	);

	return (
		<div className="flex flex-col gap-y-12">
			<ReportExternalResourcesSnapshotSection
				canRefresh={canRefresh}
				capturedAt={snapshot?.capturedAt.toISOString() ?? null}
				capturedByUserName={snapshot?.capturedByUserName ?? null}
				description={t(
					"Stored Zotero publications for this report. Refresh to capture the current search-index results.",
				)}
				emptyMessage={
					snapshot == null
						? t("No Zotero publications snapshot has been captured yet.")
						: t("No Zotero publications recorded for this snapshot.")
				}
				items={snapshot?.items ?? []}
				refreshAction={refreshCountryReportExternalResourceSnapshotAction}
				reportId={report.id}
				reportIdFieldName="countryReportId"
				section="country_zotero_publications"
				title={t("Zotero publications")}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="publications"
			/>
		</div>
	);
}
