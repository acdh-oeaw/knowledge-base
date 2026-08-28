"use client";

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
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import {
	EntityListPagination,
	EntityListSearchField,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { dashboardPageSize } from "@/config/pagination.config";
import type { ReportingKpiSort, ReportingKpisData } from "@/lib/data/admin-reporting";
import type { ListSortDirection } from "@/lib/server/list-search-params";

interface ReportingKpisPageProps {
	description: string;
	/** Column heading for the service / social-media account the value belongs to. */
	entityColumnLabel: string;
	entitySearchPlaceholder: string;
	kpi: string;
	/** Every KPI category this entity can report, in enum order. */
	kpiOptions: ReadonlyArray<string>;
	kpis: ReportingKpisData;
	dir: ListSortDirection;
	page: number;
	q: string;
	sort: ReportingKpiSort;
	title: string;
}

const pageSize = dashboardPageSize;

/** Sentinel key for "no KPI filter" — an absent search param, which `Select` cannot represent. */
const ALL_OPTION = "__all__";

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * KPI enum values are snake_case identifiers (`jobs_processed`, `watch_time`). They are data rather
 * than UI copy — the set changes with the schema, not with a translator — so they are humanised
 * here instead of being enumerated as translatable strings.
 */
function formatKpi(kpi: string): string {
	const spaced = kpi.replaceAll("_", " ");

	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The reported KPI values behind the service and social-media sections of a country report: one row
 * per (report, entity, KPI category).
 *
 * Services and social media differ only in which entity a value hangs off, so both tabs render
 * through this component — keeping their sorting, paging, and totals identical rather than
 * near-identical.
 */
export function ReportingKpisPage(props: Readonly<ReportingKpisPageProps>): ReactNode {
	const {
		description,
		dir,
		entityColumnLabel,
		entitySearchPlaceholder,
		kpi,
		kpiOptions,
		kpis,
		page,
		q,
		sort,
		title,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const search = useUrlPaginatedSearch({ dir, filters: { kpi }, page, q, sort });
	const selectedKpi = search.filters.kpi !== "" ? search.filters.kpi : ALL_OPTION;

	return (
		<Fragment>
			<section className="flex flex-col gap-y-4">
				<div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
					<div className="flex flex-col gap-y-1">
						<h2 className="text-sm font-semibold text-fg">{title}</h2>
						<p className="text-sm text-muted-fg">{description}</p>
					</div>

					<div className="flex flex-wrap items-end gap-4">
						{/*
						 * The KPI filter belongs to this tab rather than to the section's shared filter bar:
						 * the categories differ per tab, and it is what makes the total meaningful.
						 */}
						<Select
							onChange={(key) => {
								const value = String(key);
								search.setFilter("kpi", value === ALL_OPTION ? "" : value);
							}}
							value={selectedKpi}
						>
							<Label>{t("KPI")}</Label>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id={ALL_OPTION}>{t("All KPIs")}</SelectItem>
								{kpiOptions.map((option) => (
									<SelectItem key={option} id={option}>
										{formatKpi(option)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<EntityListSearchField search={search} placeholder={entitySearchPlaceholder} />
					</div>
				</div>

				<div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border bg-bg p-4">
					<p className="text-sm text-muted-fg">
						{t("{count} reported values", { count: format.number(kpis.total) })}
					</p>
					{kpis.totalValue != null ? (
						<p className="text-sm text-muted-fg">
							{t("Total {value}", { value: format.number(kpis.totalValue) })}
						</p>
					) : (
						<p className="text-sm text-muted-fg">
							{t("Select a single KPI to see a total — categories do not add up.")}
						</p>
					)}
				</div>

				<Table
					aria-label="reported kpis"
					className="overflow-x-auto [--gutter:0] sm:[--gutter:0]"
					onSortChange={search.setSortDescriptor}
					sortDescriptor={search.sortDescriptor}
				>
					<TableHeader>
						<TableColumn allowsSorting={true} id="entity" isRowHeader={true}>
							{entityColumnLabel}
						</TableColumn>
						<TableColumn>{t("Type")}</TableColumn>
						<TableColumn allowsSorting={true} id="country">
							{t("Country")}
						</TableColumn>
						<TableColumn allowsSorting={true} id="campaignYear">
							{t("Year")}
						</TableColumn>
						<TableColumn>{t("Status")}</TableColumn>
						<TableColumn allowsSorting={true} id="kpi">
							{t("KPI")}
						</TableColumn>
						<TableColumn allowsSorting={true} id="value">
							{t("Value")}
						</TableColumn>
					</TableHeader>
					<TableBody items={kpis.data}>
						{(item) => (
							<TableRow id={item.id}>
								<TableCell>{item.entityName}</TableCell>
								<TableCell>{formatKpi(item.entityType)}</TableCell>
								<TableCell>{item.countryName}</TableCell>
								<TableCell>{item.campaignYear}</TableCell>
								<TableCell>{formatStatus(item.status)}</TableCell>
								<TableCell>{formatKpi(item.kpi)}</TableCell>
								<TableCell>{format.number(item.value)}</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>

				{kpis.data.length === 0 && (
					<p className="text-sm text-muted-fg">{t("No matching reported values were found.")}</p>
				)}
			</section>

			<EntityListPagination search={search} total={kpis.total} pageSize={pageSize} />
		</Fragment>
	);
}
