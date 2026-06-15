"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { isActionStateError } from "@acdh-knowledge-base/next-lib/actions";
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
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useOptimistic, useState, useTransition } from "react";

import { EntityLifecycleStatusBadge } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-lifecycle-status-badge";
import {
	EntityDeleteModal,
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
	NewLink,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { deleteCountryAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/countries/_lib/delete-country.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { CountryMemberObserverStatus } from "@/lib/data/countries";
import { useRouter } from "@/lib/navigation/navigation";

interface CountriesPageProps {
	countries: {
		data: Array<
			Pick<schema.OrganisationalUnit, "id" | "name"> & {
				memberObserverFrom: Date | null;
				memberObserverStatus: CountryMemberObserverStatus;
				memberObserverUntil: Date | null;
				entity: Pick<schema.Entity, "slug">;
				hasDraft: boolean;
				isPublished: boolean;
			}
		>;
		total: number;
	};
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort: "name" | "status";
}

function memberObserverStatusIntent(
	status: Exclude<CountryMemberObserverStatus, null>,
): "success" | "warning" {
	return status === "is_member_of" ? "success" : "warning";
}

const pageSize = dashboardPageSize;

export function CountriesPage(props: Readonly<CountriesPageProps>): ReactNode {
	const { countries, dir: initialDir, page: initialPage, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(countries.data, (state, id: string) =>
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
				title={t("Countries")}
				description={t("Manage all countries in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/countries/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="countries"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="status">
						{t("Membership")}
					</TableColumn>
					<TableColumn>{t("From")}</TableColumn>
					<TableColumn>{t("Until")}</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/administrator/countries/${item.entity.slug}/details`}>
							<TableCell>{item.name}</TableCell>
							<TableCell>
								{item.memberObserverStatus != null ? (
									<Badge intent={memberObserverStatusIntent(item.memberObserverStatus)}>
										{item.memberObserverStatus === "is_member_of" ? t("Member") : t("Observer")}
									</Badge>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell>
								{item.memberObserverFrom != null
									? format.dateTime(item.memberObserverFrom, { dateStyle: "short" })
									: "—"}
							</TableCell>
							<TableCell>
								{item.memberObserverStatus == null
									? "—"
									: item.memberObserverUntil != null
										? format.dateTime(item.memberObserverUntil, { dateStyle: "short" })
										: t("present")}
							</TableCell>
							<TableCell>
								<EntityLifecycleStatusBadge
									hasDraft={item.hasDraft}
									isPublished={item.isPublished}
								/>
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/countries/${item.entity.slug}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/countries/${item.entity.slug}/edit`}
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

			<EntityListPagination search={search} total={countries.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("country")}
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
							const state = await deleteCountryAction(id);
							if (isActionStateError(state)) {
								const message = Array.isArray(state.message) ? state.message[0] : state.message;
								setDeleteError(message ?? t("Could not delete country. Please try again."));
								return;
							}
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete country. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
