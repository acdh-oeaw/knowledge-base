"use client";

import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import type { ReportingStatisticsData } from "@/lib/data/admin-reporting";

interface ReportingStatisticsPageProps {
	data: ReportingStatisticsData;
}

/** Shared currency options for next-intl's number formatter. */
const eurFormat = {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
} as const;

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ReportingStatisticsPage(props: Readonly<ReportingStatisticsPageProps>): ReactNode {
	const { data } = props;

	const t = useExtracted();
	const format = useFormatter();

	/**
	 * What the project-contributions sum is made of.
	 *
	 * Four whole messages rather than one ICU plural: `t()` types its values as `string`, so a
	 * `{count, plural, …}` argument never resolves as a number and the pattern renders verbatim.
	 * Whole sentences rather than concatenated fragments, so a translator can reorder them.
	 */
	function projectContributionsSubtitle(): string {
		const count = data.overview.totalProjectContributionCount;
		const reports = data.overview.countryReportsWithProjectContributions;

		if (count === 1 && reports === 1) {
			return t("1 contribution from 1 country report");
		}

		if (count === 1) {
			return t("1 contribution from {reports} country reports", {
				reports: format.number(reports),
			});
		}

		if (reports === 1) {
			return t("{count} contributions from 1 country report", { count: format.number(count) });
		}

		return t("{count} contributions from {reports} country reports", {
			count: format.number(count),
			reports: format.number(reports),
		});
	}

	/** Render a delta with an explicit sign, or an em dash when the value is unavailable. */
	function formatSignedNumber(
		value: number | null,
		kind: "number" | "currency" = "number",
	): string {
		if (value == null) {
			return "—";
		}

		return kind === "currency"
			? format.number(value, { ...eurFormat, signDisplay: "exceptZero" })
			: format.number(value, { signDisplay: "exceptZero" });
	}

	return (
		<Fragment>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border bg-bg p-4">
					<p className="text-xs font-medium tracking-wide text-muted-fg uppercase">
						{t("Campaigns")}
					</p>
					<p className="mbs-2 text-2xl font-semibold text-fg">
						{format.number(data.overview.campaignCount)}
					</p>
					<p className="mbs-1 text-sm text-muted-fg">{t("Reporting campaigns in the system")}</p>
				</div>

				<div className="rounded-lg border bg-bg p-4">
					<p className="text-xs font-medium tracking-wide text-muted-fg uppercase">
						{t("Country reports")}
					</p>
					<p className="mbs-2 text-2xl font-semibold text-fg">
						{format.number(data.overview.totalCountryReports)}
					</p>
					<p className="mbs-1 text-sm text-muted-fg">
						{t("{count} contributors reported", {
							count: format.number(data.overview.totalContributors),
						})}
					</p>
				</div>

				<div className="rounded-lg border bg-bg p-4">
					<p className="text-xs font-medium tracking-wide text-muted-fg uppercase">{t("Events")}</p>
					<p className="mbs-2 text-2xl font-semibold text-fg">
						{format.number(
							data.overview.totalCountryEvents + data.overview.totalWorkingGroupEvents,
						)}
					</p>
					<p className="mbs-1 text-sm text-muted-fg">
						{t("{country} country, {workingGroups} working group", {
							country: format.number(data.overview.totalCountryEvents),
							workingGroups: format.number(data.overview.totalWorkingGroupEvents),
						})}
					</p>
				</div>

				<div className="rounded-lg border bg-bg p-4">
					<p className="text-xs font-medium tracking-wide text-muted-fg uppercase">
						{t("Project contributions")}
					</p>
					<p className="mbs-2 text-2xl font-semibold text-fg">
						{format.number(data.overview.totalProjectContributions, eurFormat)}
					</p>
					{/*
					 * What the sum is made of. Only country reports carry project contributions, so the
					 * subtitle counts those — the working-group report total that used to sit here had
					 * nothing to do with the figure above it.
					 */}
					<p className="mbs-1 text-sm text-muted-fg">{projectContributionsSubtitle()}</p>
				</div>
			</section>

			<section className="flex flex-col gap-y-4">
				<div className="flex flex-col gap-y-1">
					<h2 className="text-sm font-semibold text-fg">{t("Campaign summary")}</h2>
					<p className="text-sm text-muted-fg">
						{t("Compare report volumes, workflow status, and aggregate activity by campaign year.")}
					</p>
				</div>

				<Table
					aria-label="campaign summary"
					className="overflow-x-auto [--gutter:0] sm:[--gutter:0]"
				>
					<TableHeader>
						<TableColumn isRowHeader={true}>{t("Year")}</TableColumn>
						<TableColumn>{t("Status")}</TableColumn>
						<TableColumn>{t("Country reports")}</TableColumn>
						<TableColumn>{t("Working group reports")}</TableColumn>
						<TableColumn>{t("Contributors")}</TableColumn>
						<TableColumn>{t("Country events")}</TableColumn>
						<TableColumn>{t("WG events")}</TableColumn>
						<TableColumn>{t("Project EUR")}</TableColumn>
					</TableHeader>
					<TableBody items={data.campaignSummaries}>
						{(item) => (
							<TableRow id={item.id}>
								<TableCell>{item.year}</TableCell>
								<TableCell>{formatStatus(item.status)}</TableCell>
								<TableCell>
									<div className="flex flex-col gap-y-0.5">
										<span>
											{format.number(
												item.countryDraftCount +
													item.countrySubmittedCount +
													item.countryAcceptedCount,
											)}
										</span>
										<span className="text-xs text-muted-fg">
											{t("{draft}/{submitted}/{accepted}", {
												accepted: format.number(item.countryAcceptedCount),
												draft: format.number(item.countryDraftCount),
												submitted: format.number(item.countrySubmittedCount),
											})}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<div className="flex flex-col gap-y-0.5">
										<span>
											{format.number(
												item.workingGroupDraftCount +
													item.workingGroupSubmittedCount +
													item.workingGroupAcceptedCount,
											)}
										</span>
										<span className="text-xs text-muted-fg">
											{t("{draft}/{submitted}/{accepted}", {
												accepted: format.number(item.workingGroupAcceptedCount),
												draft: format.number(item.workingGroupDraftCount),
												submitted: format.number(item.workingGroupSubmittedCount),
											})}
										</span>
									</div>
								</TableCell>
								<TableCell>{format.number(item.totalContributors)}</TableCell>
								<TableCell>{format.number(item.totalCountryEvents)}</TableCell>
								<TableCell>{format.number(item.totalWorkingGroupEvents)}</TableCell>
								<TableCell>{format.number(item.totalProjectContributions, eurFormat)}</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				{data.campaignSummaries.length === 0 && (
					<p className="text-sm text-muted-fg">{t("No matching campaigns were found.")}</p>
				)}
			</section>

			<section className="flex flex-col gap-y-4">
				<div className="flex flex-col gap-y-1">
					<h2 className="text-sm font-semibold text-fg">{t("Country trends")}</h2>
					<p className="text-sm text-muted-fg">
						{t(
							"Track structured country-report metrics by campaign year and compare year-over-year change.",
						)}
					</p>
				</div>

				<Table aria-label="country trends" className="overflow-x-auto [--gutter:0] sm:[--gutter:0]">
					<TableHeader>
						<TableColumn isRowHeader={true}>{t("Country")}</TableColumn>
						<TableColumn>{t("Year")}</TableColumn>
						<TableColumn>{t("Status")}</TableColumn>
						<TableColumn>{t("Contributors")}</TableColumn>
						<TableColumn>{t("Events")}</TableColumn>
						<TableColumn>{t("Institutions")}</TableColumn>
						<TableColumn>{t("Services")}</TableColumn>
						<TableColumn>{t("Project EUR")}</TableColumn>
						<TableColumn>{t("Delta contributors")}</TableColumn>
						<TableColumn>{t("Delta events")}</TableColumn>
						<TableColumn>{t("Delta EUR")}</TableColumn>
					</TableHeader>
					<TableBody items={data.countryTrends}>
						{(item) => (
							<TableRow id={`${item.countryName}-${String(item.campaignYear)}`}>
								<TableCell>{item.countryName}</TableCell>
								<TableCell>{item.campaignYear}</TableCell>
								<TableCell>{formatStatus(item.status)}</TableCell>
								<TableCell>{format.number(item.totalContributors)}</TableCell>
								<TableCell>{format.number(item.totalEvents)}</TableCell>
								<TableCell>{format.number(item.institutions)}</TableCell>
								<TableCell>{format.number(item.services)}</TableCell>
								<TableCell>{format.number(item.projectContributions, eurFormat)}</TableCell>
								<TableCell>{formatSignedNumber(item.contributorsDelta)}</TableCell>
								<TableCell>{formatSignedNumber(item.eventsDelta)}</TableCell>
								<TableCell>
									{formatSignedNumber(item.projectContributionsDelta, "currency")}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				{data.countryTrends.length === 0 && (
					<p className="text-sm text-muted-fg">{t("No matching country data were found.")}</p>
				)}
			</section>

			{data.workingGroupYearSummaries.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<div className="flex flex-col gap-y-1">
						<h2 className="text-sm font-semibold text-fg">{t("Working group yearly summary")}</h2>
						<p className="text-sm text-muted-fg">
							{t(
								"Review aggregate working-group activity by campaign year without narrative answers.",
							)}
						</p>
					</div>

					<Table
						aria-label="working group yearly summary"
						className="overflow-x-auto [--gutter:0] sm:[--gutter:0]"
					>
						<TableHeader>
							<TableColumn isRowHeader={true}>{t("Year")}</TableColumn>
							<TableColumn>{t("Reports")}</TableColumn>
							<TableColumn>{t("Status split")}</TableColumn>
							<TableColumn>{t("Members")}</TableColumn>
							<TableColumn>{t("Events")}</TableColumn>
							<TableColumn>{t("Organiser")}</TableColumn>
							<TableColumn>{t("Presenter")}</TableColumn>
							<TableColumn>{t("Social media")}</TableColumn>
						</TableHeader>
						<TableBody items={data.workingGroupYearSummaries}>
							{(item) => (
								<TableRow id={String(item.campaignYear)}>
									<TableCell>{item.campaignYear}</TableCell>
									<TableCell>{format.number(item.reportCount)}</TableCell>
									<TableCell>
										{t("{draft}/{submitted}/{accepted}", {
											accepted: format.number(item.acceptedCount),
											draft: format.number(item.draftCount),
											submitted: format.number(item.submittedCount),
										})}
									</TableCell>
									<TableCell>{format.number(item.totalMembers)}</TableCell>
									<TableCell>{format.number(item.totalEvents)}</TableCell>
									<TableCell>{format.number(item.organiserEvents)}</TableCell>
									<TableCell>{format.number(item.presenterEvents)}</TableCell>
									<TableCell>{format.number(item.socialMediaAccounts)}</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</section>
			)}
		</Fragment>
	);
}
