import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportEventsForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-events-form";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { updateCountryReportEventsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/update-country-report-events.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

interface CountryReportEventsScreenProps {
	reportId: string;
}

/** Shared "events" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportEventsScreen(
	props: Readonly<CountryReportEventsScreenProps>,
): Promise<ReactNode> {
	const { reportId } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				columns: {
					id: true,
					smallEvents: true,
					mediumEvents: true,
					largeEvents: true,
					veryLargeEvents: true,
					dariahCommissionedEvent: true,
					reusableOutcomes: true,
				},
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

	return (
		<div className="flex flex-col gap-y-12">
			<CountryReportEventsForm formAction={updateCountryReportEventsAction} report={report} />

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="events" />
		</div>
	);
}
