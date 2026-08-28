import { socialMediaKpiCategoryEnum } from "@dariah-eric/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportSocialMediaForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-social-media-form";
import { addCountryReportSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/add-country-report-social-media.action";
import { createCountryReportSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/create-country-report-social-media.action";
import { deleteCountryReportSocialMediaAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/delete-country-report-social-media.action";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { upsertCountryReportSocialMediaKpisAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/upsert-country-report-social-media-kpis.action";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getAvailableSocialMediaForReport,
	getCountryReportSocialMedia,
	getSocialMediaTypes,
} from "@/lib/data/report-social-media";
import { db } from "@/lib/db";

interface CountryReportSocialMediaScreenProps {
	reportId: string;
}

/**
 * Shared "social media KPIs" screen. See {@link getAuthorizedCountryReportForUser} for
 * authorization.
 *
 * The report covers a curated set of social media accounts (its `country_report_social_media`
 * membership — carried over from last year, then added to), each with a small set of KPI metrics.
 * Accounts are not derived from the country org-unit, since a report may cover a partner
 * institution's account or a one-off event website.
 */
export async function CountryReportSocialMediaScreen(
	props: Readonly<CountryReportSocialMediaScreenProps>,
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

	const [accounts, availableAccounts, socialMediaTypes] = await Promise.all([
		getCountryReportSocialMedia(report.id),
		getAvailableSocialMediaForReport(report.id),
		getSocialMediaTypes(),
	]);

	return (
		<div className="flex flex-col gap-y-8">
			<CountryReportSocialMediaForm
				accounts={accounts}
				addAction={addCountryReportSocialMediaAction}
				availableAccounts={availableAccounts}
				createAction={createCountryReportSocialMediaAction}
				deleteAction={deleteCountryReportSocialMediaAction}
				kpiCategories={socialMediaKpiCategoryEnum}
				reportId={report.id}
				saveKpisAction={upsertCountryReportSocialMediaKpisAction}
				socialMediaTypes={socialMediaTypes}
			/>

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="social-media"
			/>
		</div>
	);
}
