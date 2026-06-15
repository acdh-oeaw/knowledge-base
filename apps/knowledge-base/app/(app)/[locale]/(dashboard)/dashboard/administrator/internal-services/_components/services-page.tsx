"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { Badge } from "@acdh-knowledge-base/ui/badge";
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
import { deleteServiceAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-services/_lib/delete-service.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface ServicesPageProps {
	dir: "asc" | "desc";
	page: number;
	q: string;
	services: {
		data: Array<
			Pick<schema.Service, "id" | "name"> & {
				status: Pick<schema.ServiceStatus, "status">;
				type: Pick<schema.ServiceType, "type">;
			}
		>;
		total: number;
	};
	sort: "name" | "type" | "status";
}

function formatServiceStatus(status: string): string {
	return status.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function statusIntent(status: string): "success" | "warning" | "danger" | "info" {
	switch (status) {
		case "live": {
			return "success";
		}
		case "needs_review": {
			return "warning";
		}
		case "discontinued": {
			return "danger";
		}
		case "to_be_discontinued": {
			return "warning";
		}
		default: {
			return "info";
		}
	}
}

const pageSize = dashboardPageSize;

export function ServicesPage(props: Readonly<ServicesPageProps>): ReactNode {
	const { dir: initialDir, page: initialPage, q: initialQ, services, sort: initialSort } = props;

	const t = useExtracted();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(services.data, (state, id: string) =>
		state.filter((item) => item.id !== id),
	);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
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
				title={t("Internal Services")}
				description={t("Manage all internal services in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/internal-services/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="services"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="type">
						{t("Type")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="status">
						{t("Status")}
					</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow
							href={`/dashboard/administrator/internal-services/${item.id}/details`}
							id={item.id}
						>
							<TableCell>{item.name}</TableCell>
							<TableCell>{item.type.type}</TableCell>
							<TableCell>
								<Badge intent={statusIntent(item.status.status)}>
									{formatServiceStatus(item.status.status)}
								</Badge>
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/internal-services/${item.id}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/internal-services/${item.id}/edit`}
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

			<EntityListPagination search={search} total={services.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("service")}
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
						optimisticallyRemoveItem(id);
						try {
							await deleteServiceAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete service. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
