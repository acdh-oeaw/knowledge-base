import { assert } from "@acdh-oeaw/lib";
import { socialMediaKpiCategoryEnum } from "@dariah-eric/database/schema";
import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Input } from "@dariah-eric/ui/input";
import { TextField } from "@dariah-eric/ui/text-field";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportScreenCommentSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-screen-comment-section";
import { getAuthorizedCountryReportForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { upsertCountryReportSocialMediaKpisAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/upsert-country-report-social-media-kpis.action";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";

interface CountryReportSocialMediaScreenProps {
	reportId: string;
	/** Edit base path; the save action returns here (e.g. `${basePath}/social-media`). */
	basePath: string;
}

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Shared "social media KPIs" screen. See {@link getAuthorizedCountryReportForUser} for
 * authorization.
 */
export async function CountryReportSocialMediaScreen(
	props: Readonly<CountryReportSocialMediaScreenProps>,
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
							socialMedia: {
								columns: { id: true, name: true, url: true },
							},
						},
					},
					socialMediaKpis: {
						columns: { socialMediaId: true, kpi: true, value: true },
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

	const kpiMap = new Map(
		report.socialMediaKpis.map((k) => [`${k.socialMediaId}-${k.kpi}`, k.value]),
	);

	// A country report always references a published country.
	assert(report.country, "Country report is missing its published country.");
	const accounts = report.country.socialMedia;

	return (
		<div className="flex flex-col gap-y-8">
			{accounts.length === 0 ? (
				<p className="text-sm text-muted-fg">
					{t("No social media accounts linked to this country.")}
				</p>
			) : (
				<form action={upsertCountryReportSocialMediaKpisAction}>
					<input name="id" type="hidden" value={report.id} />
					<input name="redirectTo" type="hidden" value={`${basePath}/social-media`} />
					<div className="flex flex-col gap-y-8">
						{accounts.map((account) => (
							<section key={account.id} className="flex flex-col gap-y-4">
								<div className="space-y-1">
									<h2 className="text-sm font-semibold text-fg">{account.name}</h2>
									<p className="text-xs text-muted-fg">{account.url}</p>
								</div>
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
									{socialMediaKpiCategoryEnum.map((kpi) => {
										const existing = kpiMap.get(`${account.id}-${kpi}`);
										return (
											<TextField
												key={kpi}
												defaultValue={existing != null ? String(existing) : undefined}
												name={`kpis.${account.id}.${kpi}`}
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

			<ReportScreenCommentSection
				reportId={report.id}
				reportType="country"
				screenKey="social-media"
			/>
		</div>
	);
}
