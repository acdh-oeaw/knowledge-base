import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
	Header,
	HeaderAction,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import {
	LiveReportResources,
	getLiveReportResourceNavLinks,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/live-report-resources";
import { LiveReportResourcesErrorBoundary } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_components/live-report-resources-error-boundary";
import {
	ReportCommentsSection,
	reportCommentsSectionId,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-comments-section";
import { getReportScreenComments } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";
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
	const liveResourceNavLinks = await getLiveReportResourceNavLinks("country");
	const comments = await getReportScreenComments("country", report.id);
	const extraSectionLinks = [
		...liveResourceNavLinks,
		...(comments.length > 0 ? [{ id: reportCommentsSectionId, label: t("Comments") }] : []),
	];

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

			<div className="mbs-8 flex flex-col gap-y-10 px-(--layout-padding) max-inline-4xl">
				<CountryReportSummary data={report.summary} extraSectionLinks={extraSectionLinks} />
				<LiveReportResourcesErrorBoundary
					description={t(
						"External data snapshots could not be loaded. Stored report data is unaffected.",
					)}
					retryLabel={t("Retry")}
					title={t("External data snapshots")}
				>
					<LiveReportResources reportId={id} reportKind="country" />
				</LiveReportResourcesErrorBoundary>
				<ReportCommentsSection comments={comments} />
			</div>
		</div>
	);
}
