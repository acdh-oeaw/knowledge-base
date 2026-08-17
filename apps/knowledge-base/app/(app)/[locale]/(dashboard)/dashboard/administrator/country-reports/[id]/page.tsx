import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";

import {
	Header,
	HeaderAction,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import {
	LiveReportResources,
	LiveReportResourcesFallback,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/live-report-resources";
import { LiveReportResourcesErrorBoundary } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/live-report-resources-error-boundary";
import { CountryReportSummary } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-summary";
import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCountryReportPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCountryReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Country report"),
	});
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function DashboardAdministratorCountryReportPage(
	props: Readonly<DashboardAdministratorCountryReportPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const adminReport = await getCountryReportForAdmin(user, id);

	if (adminReport == null) {
		notFound();
	}

	const result = await getCountryReportDataForUser(user, id);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;

	const t = await getExtracted();

	return (
		<div>
			<Header>
				<HeaderContent>
					<HeaderTitle className="leading-tight">{report.country.name}</HeaderTitle>
					<HeaderDescription>
						{t("Campaign {year}", { year: String(report.campaign.year) })}
						{" · "}
						{formatStatus(report.status)}
					</HeaderDescription>
				</HeaderContent>
				<HeaderAction>
					<a
						className={buttonStyles({ intent: "secondary", size: "sm" })}
						download={`country-report-${id}.pdf`}
						href={`/api/reporting/country-reports/${id}/download.pdf`}
					>
						<ArrowDownTrayIcon className="me-2 block-4 inline-4" />
						{t("Download PDF")}
					</a>
					<a
						className={buttonStyles({ intent: "secondary", size: "sm" })}
						download={`country-report-${id}.json`}
						href={`/api/reporting/country-reports/${id}/download`}
					>
						<ArrowDownTrayIcon className="me-2 block-4 inline-4" />
						{t("Download JSON")}
					</a>
				</HeaderAction>
			</Header>

			<div className="mbs-8 flex flex-col gap-y-10 px-(--layout-padding)">
				<CountryReportSummary data={report.summary} />
				<LiveReportResourcesErrorBoundary
					description={t(
						"Live external data could not be loaded. Stored report data is unaffected.",
					)}
					retryLabel={t("Retry")}
					title={t("Live external data")}
				>
					<Suspense
						fallback={
							<LiveReportResourcesFallback
								description={t(
									"This fetches current search-index data on demand. These results are not stored as a report snapshot in the database.",
								)}
								loadingLabel={t("Loading live external data…")}
								title={t("Live external data")}
							/>
						}
					>
						<LiveReportResources reportId={id} reportKind="country" />
					</Suspense>
				</LiveReportResourcesErrorBoundary>
			</div>
		</div>
	);
}
