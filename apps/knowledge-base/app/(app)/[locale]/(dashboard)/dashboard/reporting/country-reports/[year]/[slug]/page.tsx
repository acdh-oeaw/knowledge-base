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
	ReportCommentsSection,
	reportCommentsSectionId,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-comments-section";
import { getReportScreenComments } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_lib/report-screen-comments";
import { CountryReportSummary } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-report-summary";
import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolveCountryReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingCountryReportPageProps extends PageProps<"/[locale]/dashboard/reporting/country-reports/[year]/[slug]"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingCountryReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country report"),
	});
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function DashboardReportingCountryReportPage(
	props: Readonly<DashboardReportingCountryReportPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveCountryReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	const { user } = await assertAuthenticated();
	const result = await getCountryReportDataForUser(user, id);

	if (result.status !== "ok") {
		notFound();
	}
	const report = result.data;

	const t = await getExtracted();
	const comments = await getReportScreenComments("country", report.id);
	const commentSectionLinks =
		comments.length > 0 ? [{ id: reportCommentsSectionId, label: t("Comments") }] : [];

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
				<CountryReportSummary data={report.summary} extraSectionLinks={commentSectionLinks} />
				<ReportCommentsSection comments={comments} />
			</div>
		</div>
	);
}
