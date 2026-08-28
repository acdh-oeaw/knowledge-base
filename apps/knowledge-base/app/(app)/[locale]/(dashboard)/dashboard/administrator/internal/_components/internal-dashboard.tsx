"use client";

import { auditLogActionEnum } from "@dariah-eric/database/schema";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { Tab, TabList, TabPanel, Tabs } from "@dariah-eric/ui/tabs";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";
import type { Key } from "react-aria-components";

import {
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { dashboardPageSize } from "@/config/pagination.config";
import type { AuditLogAction, AuditLogResult } from "@/lib/data/audit-log";
import type { ExpensiveStatementsResult } from "@/lib/data/pg-stat-statements";

interface InternalDashboardProps {
	action: AuditLogAction | undefined;
	auditLog: AuditLogResult;
	page: number;
	q: string;
	statements: ExpensiveStatementsResult;
}

const pageSize = dashboardPageSize;

function humanizeAction(action: string): string {
	return action.replaceAll("_", " ");
}

function humanizeSummaryKey(key: string): string {
	const words = key.replaceAll("_", " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatSummaryValue(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map((entry) => String(entry)).join(", ");
	}
	if (typeof value === "boolean") {
		return value ? "yes" : "no";
	}
	if (value != null && typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}

/**
 * Renders an audit summary as short human-readable text. `lifecycle` becomes a leading phrase; any
 * other keys an action explicitly recorded show as "Key: value". Returns "" when there is nothing
 * worth showing, so the cell can render a muted dash instead of `{}`.
 */
function formatAuditSummary(summary: Record<string, unknown>): string {
	const parts: Array<string> = [];

	if (summary.lifecycle === "published") {
		parts.push("Published");
	} else if (summary.lifecycle === "draft") {
		parts.push("Saved as draft");
	}

	for (const [key, value] of Object.entries(summary)) {
		if (key === "lifecycle") {
			continue;
		}
		// Legacy rows recorded every submitted field name here — deliberately noise, so drop it.
		if (key === "fields") {
			continue;
		}
		// `save-and-publish` is exactly what `lifecycle: published` already conveys.
		if (key === "intent" && value === "save-and-publish") {
			continue;
		}
		if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
			continue;
		}
		parts.push(`${humanizeSummaryKey(key)}: ${formatSummaryValue(value)}`);
	}

	return parts.join(" · ");
}

function AuditSummary({ summary }: Readonly<{ summary: Record<string, unknown> }>): ReactNode {
	const text = formatAuditSummary(summary);
	if (text === "") {
		return <span className="text-muted-fg">—</span>;
	}
	return <span className="text-sm">{text}</span>;
}

export function InternalDashboard(props: Readonly<InternalDashboardProps>): ReactNode {
	const { action, auditLog, page, q, statements } = props;

	const t = useExtracted();
	const format = useFormatter();
	const [selectedTab, setSelectedTab] = useState<Key>("audit");

	const search = useUrlPaginatedSearch({
		filters: { action: action ?? "" },
		page,
		q,
	});

	const selectedAction = search.filters.action !== "" ? search.filters.action : "all";

	return (
		<Fragment>
			<EntityListHeader
				title={t("Internal")}
				description={t("Internal diagnostics for administrators.")}
			/>

			<Tabs onSelectionChange={setSelectedTab} selectedKey={selectedTab}>
				<TabList aria-label={t("Internal diagnostics")}>
					<Tab id="audit">{t("Audit log")}</Tab>
					<Tab id="statements">{t("Expensive queries")}</Tab>
				</TabList>

				<TabPanel id="audit" className="flex flex-col gap-y-(--layout-padding)">
					<div className="flex flex-wrap items-center justify-end gap-1.5">
						<EntityListSearchField search={search} placeholder={t("Search by subject")} />

						<Select
							aria-label={t("Filter by action")}
							onChange={(key) => {
								const value = String(key);
								search.setFilter("action", value === "all" ? "" : value);
							}}
							value={selectedAction}
						>
							<SelectTrigger />
							<SelectContent>
								<SelectItem id="all">{t("All actions")}</SelectItem>
								{auditLogActionEnum.map((value) => (
									<SelectItem key={value} id={value}>
										{humanizeAction(value)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<Table
						aria-label={t("Audit log")}
						className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
					>
						<TableHeader>
							<TableColumn id="createdAt" isRowHeader={true}>
								{t("Time")}
							</TableColumn>
							<TableColumn id="actor">{t("Actor")}</TableColumn>
							<TableColumn id="action">{t("Action")}</TableColumn>
							<TableColumn id="subject">{t("Subject")}</TableColumn>
							<TableColumn id="summary">{t("Summary")}</TableColumn>
						</TableHeader>
						<TableBody items={auditLog.data} renderEmptyState={() => t("No audit log entries.")}>
							{(item) => (
								<TableRow id={item.id}>
									<TableCell>
										{format.dateTime(item.createdAt, {
											dateStyle: "medium",
											timeStyle: "short",
										})}
									</TableCell>
									<TableCell>{item.actorLabel}</TableCell>
									<TableCell>{humanizeAction(item.action)}</TableCell>
									<TableCell>
										<span className="block">{item.subjectLabel}</span>
										<span className="block text-xs text-muted-fg">{item.subjectType}</span>
									</TableCell>
									<TableCell>
										<AuditSummary summary={item.summary} />
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>

					<EntityListPagination search={search} total={auditLog.total} pageSize={pageSize} />
				</TabPanel>

				<TabPanel id="statements">
					{statements.available ? (
						<Table
							aria-label={t("Expensive queries")}
							className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
						>
							<TableHeader>
								<TableColumn id="query" isRowHeader={true}>
									{t("Query")}
								</TableColumn>
								<TableColumn id="calls">{t("Calls")}</TableColumn>
								<TableColumn id="totalExecTime">{t("Total time (ms)")}</TableColumn>
								<TableColumn id="meanExecTime">{t("Mean time (ms)")}</TableColumn>
								<TableColumn id="rows">{t("Rows")}</TableColumn>
							</TableHeader>
							<TableBody
								items={statements.data.map((statement, index) => {
									return { ...statement, id: index };
								})}
								renderEmptyState={() => t("No statements recorded yet.")}
							>
								{(item) => (
									<TableRow id={item.id}>
										<TableCell>
											<code className="block text-xs whitespace-pre-wrap max-inline-3xl">
												{item.query}
											</code>
										</TableCell>
										<TableCell>{format.number(item.calls)}</TableCell>
										<TableCell>
											{format.number(item.totalExecTime, { maximumFractionDigits: 1 })}
										</TableCell>
										<TableCell>
											{format.number(item.meanExecTime, { maximumFractionDigits: 2 })}
										</TableCell>
										<TableCell>{format.number(item.rows)}</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					) : (
						<div className="my-8 text-sm text-balance text-muted-fg">
							{t(
								"The pg_stat_statements extension is not enabled on this database. Enable it via shared_preload_libraries in the Postgres configuration to see query statistics.",
							)}
						</div>
					)}
				</TabPanel>
			</Tabs>
		</Fragment>
	);
}
