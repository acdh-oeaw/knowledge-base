import { serviceKpiCategoryEnum } from "@dariah-eric/database/schema";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { CountryReportServicesForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-services-form";
import { addCountryReportServiceAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/add-country-report-service.action";
import { deleteCountryReportServiceAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/delete-country-report-service.action";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { upsertCountryReportServiceKpisAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/upsert-country-report-service-kpis.action";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getAvailableServicesForReport,
	getCountryReportServices,
} from "@/lib/data/report-services";
import { db } from "@/lib/db";

interface CountryReportServicesScreenProps {
	reportId: string;
}

/**
 * Shared "services" screen. See {@link getAuthorizedCountryReportForUser} for authorization.
 *
 * The report owns a curated service membership, initially seeded from current consortium services
 * and the previous year's report. Each member service has a small set of on-demand KPI metrics.
 */
export async function CountryReportServicesScreen(
	props: Readonly<CountryReportServicesScreenProps>,
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

	const [services, availableServices] = await Promise.all([
		getCountryReportServices(report.id),
		getAvailableServicesForReport(report.id),
	]);

	return (
		<div className="flex flex-col gap-y-8">
			<CountryReportServicesForm
				addAction={addCountryReportServiceAction}
				availableServices={availableServices}
				deleteAction={deleteCountryReportServiceAction}
				kpiCategories={serviceKpiCategoryEnum}
				reportId={report.id}
				saveKpisAction={upsertCountryReportServiceKpisAction}
				services={services}
			/>

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="services" />
		</div>
	);
}
