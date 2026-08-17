import { assert } from "@acdh-oeaw/lib";
import { serviceKpiCategoryEnum } from "@dariah-eric/database/schema";
import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { TextField } from "@dariah-eric/ui/text-field";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { upsertCountryReportServiceKpisAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/upsert-country-report-service-kpis.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

interface CountryReportServicesScreenProps {
	reportId: string;
	/** Edit base path; the save action returns here (e.g. `${basePath}/services`). */
	basePath: string;
}

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

/** Shared "services" screen. See {@link getAuthorizedCountryReportForUser} for authorization. */
export async function CountryReportServicesScreen(
	props: Readonly<CountryReportServicesScreenProps>,
): Promise<ReactNode> {
	const { reportId, basePath } = props;

	const { user } = await assertAuthenticated();
	const result = await getAuthorizedCountryReportForUser(
		user,
		reportId,
		(id) =>
			db.query.countryReports.findFirst({
				where: { id },
				columns: { id: true },
				with: {
					country: {
						columns: { id: true },
						with: {
							services: {
								columns: { id: true, name: true },
							},
						},
					},
					serviceKpis: {
						columns: { serviceId: true, kpi: true, value: true },
					},
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

	const t = await getExtracted();

	const kpiMap = new Map(report.serviceKpis.map((k) => [`${k.serviceId}-${k.kpi}`, k.value]));

	// A country report always references a published country.
	assert(report.country, "Country report is missing its published country.");
	const services = report.country.services;

	return (
		<div className="flex flex-col gap-y-8">
			{services.length === 0 ? (
				<p className="text-sm text-muted-fg">{t("No services linked to this country.")}</p>
			) : (
				<form action={upsertCountryReportServiceKpisAction}>
					<input name="id" type="hidden" value={report.id} />
					<input name="redirectTo" type="hidden" value={`${basePath}/services`} />
					<div className="flex flex-col gap-y-8">
						{services.map((service) => (
							<section key={service.id} className="flex flex-col gap-y-4">
								<h2 className="text-sm font-semibold text-fg">{service.name}</h2>
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
									{serviceKpiCategoryEnum.map((kpi) => {
										const existing = kpiMap.get(`${service.id}-${kpi}`);
										return (
											<TextField
												key={kpi}
												defaultValue={existing != null ? String(existing) : undefined}
												name={`kpis.${service.id}.${kpi}`}
												type="number"
											>
												<Label className="text-xs">{formatKpi(kpi)}</Label>
												<Input min={0} />
											</TextField>
										);
									})}
								</div>
							</section>
						))}
					</div>
					<div className="mbs-6">
						<Button type="submit">{t("Save")}</Button>
					</div>
				</form>
			)}

			<ReportScreenCommentSection reportId={report.id} reportType="country" screenKey="services" />
		</div>
	);
}
