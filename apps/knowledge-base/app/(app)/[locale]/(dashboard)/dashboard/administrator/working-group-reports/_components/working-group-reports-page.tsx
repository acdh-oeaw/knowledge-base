"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@acdh-knowledge-base/ui/table";
import { EyeIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useOptimistic, useState, useTransition } from "react";

import {
	EntityDeleteModal,
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
	NewLink,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { deleteWorkingGroupReportAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-group-reports/_lib/delete-working-group-report.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";
import type { ListSortDirection } from "@/lib/server/list-search-params";

type WorkingGroupReportRow = Pick<schema.WorkingGroupReport, "id" | "status"> & {
	campaign: Pick<schema.ReportingCampaign, "id" | "year">;
	workingGroup: Pick<schema.OrganisationalUnit, "id" | "name">;
};

interface WorkingGroupReportsPageProps {
	dir: ListSortDirection;
	reports: { data: Array<WorkingGroupReportRow>; total: number };
	page: number;
	q: string;
	sort: "campaignYear" | "workingGroup";
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

const pageSize = dashboardPageSize;

export function WorkingGroupReportsPage(props: Readonly<WorkingGroupReportsPageProps>): ReactNode {
	const { dir: initialDir, reports, page: initialPage, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const router = useRouter();
	const [items, optimisticallyRemoveReport] = useOptimistic(reports.data, (state, id: string) =>
		state.filter((r) => r.id !== id),
	);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [isDeletePending, startDeleteTransition] = useTransition();
	const search = useUrlPaginatedSearch({
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	});

	return (
		<Fragment>
			<EntityListHeader
				title={t("Working group reports")}
				description={t("Manage all working group reports in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/working-group-reports/create">
							{t("New")}
						</NewLink>
					</>
				}
			/>

			<Table
				aria-label="working group reports"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="workingGroup" isRowHeader={true}>
						{t("Working group")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="campaignYear">
						{t("Campaign")}
					</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow
							href={`/dashboard/administrator/working-group-reports/${item.id}`}
							id={item.id}
						>
							<TableCell>{item.workingGroup.name}</TableCell>
							<TableCell>{item.campaign.year}</TableCell>
							<TableCell>{formatStatus(item.status)}</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/working-group-reports/${item.id}`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/working-group-reports/${item.id}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Separator />
									<RowActionsMenu.Action
										danger={true}
										icon={<TrashIcon className="me-2 block-4 inline-4" />}
										onAction={() => {
											setItemToDelete({ id: item.id });
										}}
									>
										{t("Delete")}
									</RowActionsMenu.Action>
								</RowActionsMenu>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>

			<EntityListPagination search={search} total={reports.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("working group report")}
				isPending={isDeletePending}
				error={deleteError}
				onClose={() => {
					setItemToDelete(null);
					setDeleteError(null);
				}}
				onConfirm={() => {
					if (itemToDelete == null) {
						return;
					}

					const id = itemToDelete.id;
					setDeleteError(null);

					startDeleteTransition(async () => {
						optimisticallyRemoveReport(id);
						try {
							await deleteWorkingGroupReportAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete working group report. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
