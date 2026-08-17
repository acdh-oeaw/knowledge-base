"use client";

import { Button } from "@dariah-eric/ui/button";
import { Label } from "@dariah-eric/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { useExtracted } from "next-intl";
import { type ReactNode, useOptimistic, useTransition } from "react";
import type { Key } from "react-aria-components";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import type { ReportingStatisticsData } from "@/lib/data/admin-reporting";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation/navigation";

interface Filters {
	campaignYear: string;
	countryName: string;
}

interface ReportingStatisticsPageProps {
	data: ReportingStatisticsData;
	filters: Filters;
}

/**
 * Sentinel `Select` key for the "no filter" option. React Aria's `Select` needs a non-null key for
 * every option, but "all" is represented by an _absent_ search param. The sentinel is converted
 * away at the search-param boundary (see `applyFilters` and `toSelectedKey`) and is never written
 * to the URL, so it cannot collide with a real campaign year or country name.
 */
const ALL_OPTION = "__all__";

function toSelectedKey(value: string): Key {
	return value === "" ? ALL_OPTION : value;
}

function fromSelectedKey(key: Key | null): string {
	return key == null || key === ALL_OPTION ? "" : String(key);
}

const eurFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSignedNumber(
	value: number | null,
	format: "number" | "currency" = "number",
): string {
	if (value == null) {
		return "—";
	}

	const sign = value > 0 ? "+" : "";

	if (format === "currency") {
		return `${sign}${eurFormatter.format(value)}`;
	}

	return `${sign}${value.toLocaleString()}`;
}

export function ReportingStatisticsPage(props: Readonly<ReportingStatisticsPageProps>): ReactNode {
	const { data, filters } = props;

	const t = useExtracted();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [optimisticFilters, setOptimisticFilters] = useOptimistic(filters);

	/** Sync the filters to the search params, refetching the page data server-side. */
	function applyFilters(next: Filters) {
		const params = new URLSearchParams(searchParams.toString());

		if (next.campaignYear === "") {
			params.delete("campaignYear");
		} else {
			params.set("campaignYear", next.campaignYear);
		}

		if (next.countryName === "") {
			params.delete("country");
		} else {
			params.set("country", next.countryName);
		}

		const query = params.toString();

		startTransition(() => {
			// Reflect the choice in the selects immediately; React resets this to the server-provided
			// `filters` once the navigation settles.
			setOptimisticFilters(next);
			router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
		});
	}

	function handleCampaignYearChange(key: Key | null) {
		applyFilters({ ...optimisticFilters, campaignYear: fromSelectedKey(key) });
	}

	function handleCountryChange(key: Key | null) {
		applyFilters({ ...optimisticFilters, countryName: fromSelectedKey(key) });
	}

	function handleReset() {
		applyFilters({ campaignYear: "", countryName: "" });
	}

	const hasFilters = optimisticFilters.campaignYear !== "" || optimisticFilters.countryName !== "";

	return (
		<div className="flex flex-col gap-y-8">
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Statistics")}</HeaderTitle>
					<HeaderDescription>
						{t(
							"Review aggregate reporting data across campaigns and compare country-level changes over time.",
						)}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="flex flex-col gap-y-10 px-(--layout-padding)">
				<section className="rounded-lg border bg-bg p-4">
					<div className="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,16rem)_auto]">
						<Select
							onChange={handleCampaignYearChange}
							value={toSelectedKey(optimisticFilters.campaignYear)}
						>
							<Label>{t("Campaign year")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All years")}</SelectItem>
								{data.filterOptions.campaignYears.map((year) => (
									<SelectItem key={year} id={String(year)}>
										{String(year)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							onChange={handleCountryChange}
							value={toSelectedKey(optimisticFilters.countryName)}
						>
							<Label>{t("Country")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All countries")}</SelectItem>
								{data.filterOptions.countries.map((country) => (
									<SelectItem key={country} id={country}>
										{country}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="flex items-end">
							<Button intent="outline" isDisabled={!hasFilters} onPress={handleReset}>
								{t("Reset")}
							</Button>
						</div>
					</div>
				</section>

				{/* Visually hidden, polite status region announces the refetch to assistive tech. */}
				<p className="sr-only" role="status">
					{isPending ? t("Loading results…") : ""}
				</p>

				{/*
				 * Dim the results while the new data is fetched. The fade only kicks in after a short
				 * delay so a quick response never flashes; on the way back the delay is 0 so it snaps
				 * to full opacity immediately.
				 */}
				<div
					className={
						isPending
							? "flex flex-col gap-y-10 opacity-60 transition-opacity delay-300 duration-200"
							: "flex flex-col gap-y-10 opacity-100 transition-opacity duration-200"
					}
				>
					<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Campaigns")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{data.overview.campaignCount.toLocaleString()}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("Reporting campaigns in the system")}
							</p>
						</div>

						<div className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Country reports")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{data.overview.totalCountryReports.toLocaleString()}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("{count} contributors reported", {
									count: data.overview.totalContributors.toLocaleString(),
								})}
							</p>
						</div>

						<div className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Events")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{(
									data.overview.totalCountryEvents + data.overview.totalWorkingGroupEvents
								).toLocaleString()}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("{country} country, {workingGroups} working group", {
									country: data.overview.totalCountryEvents.toLocaleString(),
									workingGroups: data.overview.totalWorkingGroupEvents.toLocaleString(),
								})}
							</p>
						</div>

						<div className="rounded-lg border bg-bg p-4">
							<p className="text-xs font-medium uppercase tracking-wide text-muted-fg">
								{t("Project contributions")}
							</p>
							<p className="mbs-2 text-2xl font-semibold text-fg">
								{eurFormatter.format(data.overview.totalProjectContributions)}
							</p>
							<p className="mbs-1 text-sm text-muted-fg">
								{t("{count} working group reports", {
									count: data.overview.totalWorkingGroupReports.toLocaleString(),
								})}
							</p>
						</div>
					</section>

					<section className="flex flex-col gap-y-4">
						<div className="flex flex-col gap-y-1">
							<h2 className="text-sm font-semibold text-fg">{t("Campaign summary")}</h2>
							<p className="text-sm text-muted-fg">
								{t(
									"Compare report volumes, workflow status, and aggregate activity by campaign year.",
								)}
							</p>
						</div>

						<Table
							aria-label="campaign summary"
							className="[--gutter:0] overflow-x-auto sm:[--gutter:0]"
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
													{item.countryDraftCount +
														item.countrySubmittedCount +
														item.countryAcceptedCount}
												</span>
												<span className="text-xs text-muted-fg">
													{t("{draft}/{submitted}/{accepted}", {
														accepted: String(item.countryAcceptedCount),
														draft: String(item.countryDraftCount),
														submitted: String(item.countrySubmittedCount),
													})}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-y-0.5">
												<span>
													{item.workingGroupDraftCount +
														item.workingGroupSubmittedCount +
														item.workingGroupAcceptedCount}
												</span>
												<span className="text-xs text-muted-fg">
													{t("{draft}/{submitted}/{accepted}", {
														accepted: String(item.workingGroupAcceptedCount),
														draft: String(item.workingGroupDraftCount),
														submitted: String(item.workingGroupSubmittedCount),
													})}
												</span>
											</div>
										</TableCell>
										<TableCell>{item.totalContributors.toLocaleString()}</TableCell>
										<TableCell>{item.totalCountryEvents.toLocaleString()}</TableCell>
										<TableCell>{item.totalWorkingGroupEvents.toLocaleString()}</TableCell>
										<TableCell>{eurFormatter.format(item.totalProjectContributions)}</TableCell>
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

						<Table
							aria-label="country trends"
							className="[--gutter:0] overflow-x-auto sm:[--gutter:0]"
						>
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
										<TableCell>{item.totalContributors.toLocaleString()}</TableCell>
										<TableCell>{item.totalEvents.toLocaleString()}</TableCell>
										<TableCell>{item.institutions.toLocaleString()}</TableCell>
										<TableCell>{item.services.toLocaleString()}</TableCell>
										<TableCell>{eurFormatter.format(item.projectContributions)}</TableCell>
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
								<h2 className="text-sm font-semibold text-fg">
									{t("Working group yearly summary")}
								</h2>
								<p className="text-sm text-muted-fg">
									{t(
										"Review aggregate working-group activity by campaign year without narrative answers.",
									)}
								</p>
							</div>

							<Table
								aria-label="working group yearly summary"
								className="[--gutter:0] overflow-x-auto sm:[--gutter:0]"
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
											<TableCell>{item.reportCount.toLocaleString()}</TableCell>
											<TableCell>
												{t("{draft}/{submitted}/{accepted}", {
													accepted: String(item.acceptedCount),
													draft: String(item.draftCount),
													submitted: String(item.submittedCount),
												})}
											</TableCell>
											<TableCell>{item.totalMembers.toLocaleString()}</TableCell>
											<TableCell>{item.totalEvents.toLocaleString()}</TableCell>
											<TableCell>{item.organiserEvents.toLocaleString()}</TableCell>
											<TableCell>{item.presenterEvents.toLocaleString()}</TableCell>
											<TableCell>{item.socialMediaAccounts.toLocaleString()}</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
