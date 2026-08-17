import { ButtonLink } from "@dariah-eric/ui/button-link";
import { EmptyState } from "@dariah-eric/ui/empty-state";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import type { CountryReportScope, WorkingGroupReportScope } from "@/lib/data/reporting";

interface ReportingOverviewPageProps {
	scope: {
		campaignYear: number | null;
		workingGroupReports: Array<WorkingGroupReportScope>;
		countryReports: Array<CountryReportScope>;
	};
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function groupReportsByStatus<T extends { status: string }>(
	reports: Array<T>,
): Record<string, Array<T>> {
	return reports.reduce<Record<string, Array<T>>>((groups, report) => {
		const status = report.status;
		groups[status] ??= [];
		groups[status].push(report);
		return groups;
	}, {});
}

export async function ReportingOverviewPage(
	props: Readonly<ReportingOverviewPageProps>,
): Promise<ReactNode> {
	const { scope } = props;

	const t = await getExtracted();

	const hasReports = scope.workingGroupReports.length > 0 || scope.countryReports.length > 0;
	const countryDraftCount = scope.countryReports.filter(
		(report) => report.status === "draft",
	).length;
	const countrySubmittedCount = scope.countryReports.filter(
		(report) => report.status === "submitted",
	).length;
	const countryAcceptedCount = scope.countryReports.filter(
		(report) => report.status === "accepted",
	).length;
	const workingGroupDraftCount = scope.workingGroupReports.filter(
		(report) => report.status === "draft",
	).length;
	const workingGroupSubmittedCount = scope.workingGroupReports.filter(
		(report) => report.status === "submitted",
	).length;
	const workingGroupAcceptedCount = scope.workingGroupReports.filter(
		(report) => report.status === "accepted",
	).length;

	const groupedCountryReports = groupReportsByStatus(scope.countryReports);
	const groupedWorkingGroupReports = groupReportsByStatus(scope.workingGroupReports);
	const statusOrder = ["draft", "submitted", "accepted"];

	return (
		<Fragment>
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Reporting")}</HeaderTitle>
					<HeaderDescription>
						{scope.campaignYear != null
							? t("Manage your reports for the current reporting campaign.")
							: t("View and manage reports.")}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			{!hasReports ? (
				<EmptyState
					description={t("No country or working group reports are available.")}
					title={t("No reports found")}
				/>
			) : (
				<div className="flex flex-col gap-y-10 px-(--layout-padding)">
					<div className="grid gap-4 md:grid-cols-3">
						<section className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Campaign")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">{scope.campaignYear ?? "—"}</p>
							<p className="mbs-1 text-sm text-muted-fg">{t("Current open reporting campaign")}</p>
						</section>

						<section className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Country reports")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{scope.countryReports.length.toLocaleString()}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("{draft} draft, {submitted} submitted, {accepted} accepted", {
									accepted: String(countryAcceptedCount),
									draft: String(countryDraftCount),
									submitted: String(countrySubmittedCount),
								})}
							</p>
						</section>

						<section className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Working group reports")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{scope.workingGroupReports.length.toLocaleString()}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("{draft} draft, {submitted} submitted, {accepted} accepted", {
									accepted: String(workingGroupAcceptedCount),
									draft: String(workingGroupDraftCount),
									submitted: String(workingGroupSubmittedCount),
								})}
							</p>
						</section>
					</div>

					{scope.workingGroupReports.length > 0 && (
						<section className="flex flex-col gap-y-4">
							<div className="flex flex-col gap-y-1">
								<h2 className="text-sm font-semibold text-fg">{t("Working group reports")}</h2>
								<p className="text-sm text-muted-fg">
									{t("Use this page to keep current working group reports moving forward.")}
								</p>
							</div>
							<div className="grid gap-4 lg:grid-cols-3">
								{statusOrder.map((status) => {
									const reports = groupedWorkingGroupReports[status] ?? [];

									if (reports.length === 0) {
										return null;
									}

									return (
										<section key={status} className="rounded-lg border bg-bg">
											<div className="border-be px-4 py-3">
												<h3 className="text-sm font-medium text-fg">{formatStatus(status)}</h3>
												<p className="text-xs text-muted-fg">
													{t("{count} reports", { count: String(reports.length) })}
												</p>
											</div>
											<ul className="divide-y">
												{reports.map((report) => (
													<li
														key={report.reportId}
														className="flex items-center justify-between gap-x-4 px-4 py-3"
													>
														<div className="flex flex-col gap-y-0.5">
															<span className="text-sm font-medium">{report.workingGroupName}</span>
															<span className="text-xs text-muted-fg">
																{report.canConfirm
																	? t("You can confirm this report.")
																	: t("You can edit this report.")}
															</span>
														</div>
														<ButtonLink href={`${report.reportHref}/edit`} intent="plain" size="sm">
															{t("Open")}
														</ButtonLink>
													</li>
												))}
											</ul>
										</section>
									);
								})}
							</div>
						</section>
					)}

					{scope.countryReports.length > 0 && (
						<section className="flex flex-col gap-y-4">
							<div className="flex flex-col gap-y-1">
								<h2 className="text-sm font-semibold text-fg">{t("Country reports")}</h2>
								<p className="text-sm text-muted-fg">
									{t("Track the current state of your country reports for the open campaign.")}
								</p>
							</div>
							<div className="grid gap-4 lg:grid-cols-3">
								{statusOrder.map((status) => {
									const reports = groupedCountryReports[status] ?? [];

									if (reports.length === 0) {
										return null;
									}

									return (
										<section key={status} className="rounded-lg border bg-bg">
											<div className="border-be px-4 py-3">
												<h3 className="text-sm font-medium text-fg">{formatStatus(status)}</h3>
												<p className="text-xs text-muted-fg">
													{t("{count} reports", { count: String(reports.length) })}
												</p>
											</div>
											<ul className="divide-y">
												{reports.map((report) => (
													<li
														key={report.reportId}
														className="flex items-center justify-between gap-x-4 px-4 py-3"
													>
														<div className="flex flex-col gap-y-0.5">
															<span className="text-sm font-medium">{report.countryName}</span>
															<span className="text-xs text-muted-fg">
																{report.canConfirm
																	? t("You can confirm this report.")
																	: t("You can edit this report.")}
															</span>
														</div>
														<ButtonLink href={`${report.reportHref}/edit`} intent="plain" size="sm">
															{t("Open")}
														</ButtonLink>
													</li>
												))}
											</ul>
										</section>
									);
								})}
							</div>
						</section>
					)}
				</div>
			)}
		</Fragment>
	);
}
