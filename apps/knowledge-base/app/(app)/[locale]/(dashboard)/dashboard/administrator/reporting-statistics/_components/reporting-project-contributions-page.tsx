"use client";

import { Link } from "@dariah-eric/ui/link";
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

import {
	EntityListPagination,
	EntityListSearchField,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { dashboardPageSize } from "@/config/pagination.config";
import type {
	ReportingProjectContributionsData,
	ReportingProjectContributionsSort,
} from "@/lib/data/admin-reporting";
import type { ListSortDirection } from "@/lib/server/list-search-params";

interface ReportingProjectContributionsPageProps {
	contributions: ReportingProjectContributionsData;
	dir: ListSortDirection;
	page: number;
	q: string;
	sort: ReportingProjectContributionsSort;
}

/** Shared currency options for next-intl's number formatter. */
const eurFormat = {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
} as const;

const pageSize = dashboardPageSize;

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * The line items behind the aggregate project-contribution figures on the overview tab: one row per
 * (country report, project) pair, so a reader can see which country reported which project in which
 * campaign year, and for how much.
 *
 * Campaign-year/country/status filtering lives in the section layout's shared filter bar; the
 * search, sorting, and paging owned here sit alongside it in the same URL.
 */
export function ReportingProjectContributionsPage(
	props: Readonly<ReportingProjectContributionsPageProps>,
): ReactNode {
	const { contributions, dir, page, q, sort } = props;

	const t = useExtracted();
	const format = useFormatter();
	const search = useUrlPaginatedSearch({ dir, page, q, sort });

	return (
		<Fragment>
			<section className="flex flex-col gap-y-4">
				<div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
					<div className="flex flex-col gap-y-1">
						<h2 className="text-sm font-semibold text-fg">{t("Reported project contributions")}</h2>
						<p className="text-sm text-muted-fg">
							{t(
								"See which country reported which project in which campaign year, and with what monetary contribution.",
							)}
						</p>
					</div>

					<EntityListSearchField search={search} placeholder={t("Search by project")} />
				</div>

				{/*
				 * Totals cover the whole filtered set, not just the current page — the sum is the number
				 * most readers come here for, and a per-page subtotal would quietly mislead.
				 *
				 * The entry count and the pair count differ on purpose. A country re-reports a project
				 * every year it runs, entering the whole-duration amount each time, so the table lists
				 * more entries than there are actual contributions. The total counts each pair once; the
				 * caption says so, because otherwise the numbers look like they disagree.
				 */}
				<div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border bg-bg p-4">
					<p className="text-sm text-muted-fg">
						{t("{count} reported entries", { count: format.number(contributions.total) })}
					</p>
					<p className="text-sm text-muted-fg">
						{t("{count} country–project pairs", {
							count: format.number(contributions.totalPairs),
						})}
					</p>
					<p className="text-sm text-muted-fg">
						{t("Total {amount}, counting each pair once", {
							amount: format.number(contributions.totalAmountEuros, eurFormat),
						})}
					</p>
				</div>

				<Table
					aria-label="reported project contributions"
					className="overflow-x-auto [--gutter:0] sm:[--gutter:0]"
					onSortChange={search.setSortDescriptor}
					sortDescriptor={search.sortDescriptor}
				>
					<TableHeader>
						<TableColumn allowsSorting={true} id="project" isRowHeader={true}>
							{t("Project")}
						</TableColumn>
						<TableColumn allowsSorting={true} id="country">
							{t("Country")}
						</TableColumn>
						<TableColumn allowsSorting={true} id="campaignYear">
							{t("Year")}
						</TableColumn>
						<TableColumn>{t("Status")}</TableColumn>
						<TableColumn allowsSorting={true} id="amount">
							{t("Amount")}
						</TableColumn>
					</TableHeader>
					<TableBody items={contributions.data}>
						{(item) => (
							<TableRow id={item.id}>
								<TableCell>
									<Link href={`/dashboard/administrator/projects/${item.projectSlug}/details`}>
										{item.projectAcronym != null && item.projectAcronym !== ""
											? `${item.projectName} (${item.projectAcronym})`
											: item.projectName}
									</Link>
								</TableCell>
								<TableCell>{item.countryName}</TableCell>
								<TableCell>{item.campaignYear}</TableCell>
								<TableCell>{formatStatus(item.status)}</TableCell>
								<TableCell>{format.number(item.amountEuros, eurFormat)}</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>

				{contributions.data.length === 0 && (
					<p className="text-sm text-muted-fg">
						{t("No matching project contributions were found.")}
					</p>
				)}
			</section>

			<EntityListPagination search={search} total={contributions.total} pageSize={pageSize} />
		</Fragment>
	);
}
