"use client";

import type * as schema from "@dariah-eric/database/schema";
import { isActionStateError } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { EyeIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useOptimistic, useState, useTransition } from "react";

import { EntityLifecycleStatusBadge } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-status-badge";
import {
	EntityDeleteModal,
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
	EntityListTitle,
	NewLink,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { deleteOpportunityAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/opportunities/_lib/delete-opportunity.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface OpportunitiesPageProps {
	dir: "asc" | "desc";
	opportunities: {
		data: Array<
			Pick<schema.Opportunity, "id" | "duration" | "sourceId" | "title" | "summary" | "website"> & {
				documentId: string;
				entity: { slug: string };
				hasDraft: boolean;
				isPublished: boolean;
				source: Pick<schema.OpportunitySource, "id" | "source">;
			}
		>;
		total: number;
	};
	page: number;
	q: string;
	sort: "duration" | "source" | "title";
}

const pageSize = dashboardPageSize;

export function OpportunitiesPage(props: Readonly<OpportunitiesPageProps>): ReactNode {
	const {
		dir: initialDir,
		opportunities,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(opportunities.data, (state, id: string) =>
		state.filter((item) => item.id !== id),
	);
	const [itemToDelete, setItemToDelete] = useState<{ id: string; documentId: string } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const search = useUrlPaginatedSearch({
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	});
	const [isDeletePending, startDeleteTransition] = useTransition();

	return (
		<Fragment>
			<EntityListHeader
				title={t("Opportunities")}
				description={t("Manage all opportunities in the DARIAH knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/website/opportunities/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="opportunities"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="title" isRowHeader={true}>
						{t("Title")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="source">
						{t("Source")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="duration">
						{t("Duration")}
					</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/website/opportunities/${item.entity.slug}/details`}>
							<TableCell>
								<EntityListTitle title={item.title} />
							</TableCell>
							<TableCell>
								<Badge intent={item.source.source === "dariah" ? "danger" : "info"}>
									{item.source.source}
								</Badge>
							</TableCell>
							<TableCell>
								{item.duration.end != null
									? format.dateTimeRange(item.duration.start, item.duration.end, {
											dateStyle: "short",
										})
									: format.dateTime(item.duration.start, { dateStyle: "short" })}
							</TableCell>
							<TableCell>
								<EntityLifecycleStatusBadge
									hasDraft={item.hasDraft}
									isPublished={item.isPublished}
								/>
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/website/opportunities/${item.entity.slug}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/website/opportunities/${item.entity.slug}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Separator />
									<RowActionsMenu.Action
										danger={true}
										icon={<TrashIcon className="me-2 block-4 inline-4" />}
										onAction={() => {
											setItemToDelete({ id: item.id, documentId: item.documentId });
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

			<EntityListPagination search={search} total={opportunities.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("opportunity")}
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

					const { id, documentId } = itemToDelete;
					setDeleteError(null);

					startDeleteTransition(async () => {
						optimisticallyRemoveItem(id);
						try {
							const state = await deleteOpportunityAction(documentId);
							if (isActionStateError(state)) {
								const message = Array.isArray(state.message) ? state.message[0] : state.message;
								setDeleteError(message ?? t("Could not delete opportunity. Please try again."));
								return;
							}
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete opportunity. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
