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
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
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
import { deleteReportingCampaignAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/reporting-campaigns/_lib/delete-reporting-campaign.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";
import type { ListSortDirection } from "@/lib/server/list-search-params";

interface ReportingCampaignsPageProps {
	campaigns: {
		data: Array<
			Pick<schema.ReportingCampaign, "id" | "year" | "status"> & {
				hasReports: boolean;
				countryReportCount: number;
				workingGroupReportCount: number;
			}
		>;
		total: number;
	};
	dir: ListSortDirection;
	page: number;
	q: string;
	sort: "year";
}

const pageSize = dashboardPageSize;

export function ReportingCampaignsPage(props: Readonly<ReportingCampaignsPageProps>): ReactNode {
	const { campaigns, dir: initialDir, page: initialPage, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const router = useRouter();
	const [items, optimisticallyRemoveCampaign] = useOptimistic(campaigns.data, (state, id: string) =>
		state.filter((c) => c.id !== id),
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
				title={t("Reporting campaigns")}
				description={t("Manage all reporting campaigns in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/reporting-campaigns/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="reporting campaigns"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="year" isRowHeader={true}>
						{t("Year")}
					</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn>{t("Country reports")}</TableColumn>
					<TableColumn>{t("Working group reports")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow id={item.id}>
							<TableCell>{item.year}</TableCell>
							<TableCell>{item.status}</TableCell>
							<TableCell>{item.countryReportCount}</TableCell>
							<TableCell>{item.workingGroupReportCount}</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/reporting-campaigns/${item.id}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Separator />
									<RowActionsMenu.Action
										danger={true}
										icon={<TrashIcon className="me-2 block-4 inline-4" />}
										isDisabled={item.hasReports}
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

			<EntityListPagination search={search} total={campaigns.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("reporting campaign")}
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
						optimisticallyRemoveCampaign(id);
						try {
							await deleteReportingCampaignAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete reporting campaign. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
