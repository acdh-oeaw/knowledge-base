"use client";

import { Badge } from "@acdh-knowledge-base/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@acdh-knowledge-base/ui/table";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode } from "react";

import {
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { dashboardPageSize } from "@/config/pagination.config";
import type { NewslettersResult } from "@/lib/data/newsletters";

interface NewslettersPageProps {
	newsletters: NewslettersResult;
	page: number;
	q: string;
}

const pageSize = dashboardPageSize;

export function NewslettersPage(props: Readonly<NewslettersPageProps>): ReactNode {
	const { newsletters, page: initialPage, q: initialQ } = props;

	const t = useExtracted();
	const format = useFormatter();
	const search = useUrlPaginatedSearch({ page: initialPage, q: initialQ });

	return (
		<Fragment>
			<EntityListHeader
				title={t("Newsletters")}
				description={t("View all newsletters in the knowledge base.")}
				action={<EntityListSearchField search={search} />}
			/>

			<Table
				aria-label="newsletters"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
			>
				<TableHeader>
					<TableColumn isRowHeader={true}>{t("Title")}</TableColumn>
					<TableColumn>{t("Send time")}</TableColumn>
					<TableColumn>{t("Emails sent")}</TableColumn>
					<TableColumn>{t("URL")}</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn>{t("Opens")}</TableColumn>
					<TableColumn>{t("Clicks")}</TableColumn>
				</TableHeader>
				<TableBody items={newsletters.data}>
					{(item) => (
						<TableRow>
							<TableCell>{item.settings.subject_line}</TableCell>
							<TableCell>
								{item.send_time
									? format.dateTime(new Date(item.send_time), { dateStyle: "short" })
									: null}
							</TableCell>
							<TableCell>{format.number(item.emails_sent)}</TableCell>
							<TableCell>
								<a className="underline" href={item.archive_url} rel="noreferrer" target="_blank">
									{item.archive_url}
								</a>
							</TableCell>
							<TableCell>
								<Badge intent={item.status === "sent" ? "success" : "primary"}>{item.status}</Badge>
							</TableCell>
							<TableCell>
								{item.report_summary != null ? (
									<Fragment>
										{format.number(item.report_summary.opens)} (
										{(item.report_summary.open_rate * 100).toFixed(2)}
										{"%"})
									</Fragment>
								) : null}
							</TableCell>
							<TableCell>
								{item.report_summary != null ? (
									<Fragment>
										{format.number(item.report_summary.clicks)} (
										{(item.report_summary.click_rate * 100).toFixed(2)}
										{"%"})
									</Fragment>
								) : null}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<EntityListPagination search={search} total={newsletters.total} pageSize={pageSize} />
		</Fragment>
	);
}
