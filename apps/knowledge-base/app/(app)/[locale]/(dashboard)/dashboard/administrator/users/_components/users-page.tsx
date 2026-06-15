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
import { deleteUserAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/delete-user.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface UsersPageProps {
	currentUserCanManageAdmins: boolean;
	currentUserId: string;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort: "name" | "email" | "role" | "canManageAdmins" | "isEmailVerified";
	users: {
		data: Array<
			Pick<schema.User, "id" | "name" | "email" | "role" | "canManageAdmins" | "isEmailVerified">
		>;
		total: number;
	};
}

const pageSize = dashboardPageSize;

export function UsersPage(props: Readonly<UsersPageProps>): ReactNode {
	const {
		currentUserCanManageAdmins,
		currentUserId,
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
		users,
	} = props;

	const t = useExtracted();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(users.data, (state, id: string) =>
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
				title={t("Users")}
				description={t("Manage all users in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/users/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="users"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="email">
						{t("Email")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="role">
						{t("Role")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="canManageAdmins">
						{t("Can manage admins")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="isEmailVerified">
						{t("Email verified")}
					</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow id={item.id}>
							<TableCell>{item.name}</TableCell>
							<TableCell>{item.email}</TableCell>
							<TableCell>{item.role}</TableCell>
							<TableCell>{item.canManageAdmins ? t("Yes") : t("No")}</TableCell>
							<TableCell>{item.isEmailVerified ? t("Yes") : t("No")}</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/users/${item.id}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
										isDisabled={!currentUserCanManageAdmins && item.role === "admin"}
									>
										{t("Edit")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Separator />
									<RowActionsMenu.Action
										danger={true}
										icon={<TrashIcon className="me-2 block-4 inline-4" />}
										isDisabled={
											item.id === currentUserId ||
											(!currentUserCanManageAdmins && item.role === "admin")
										}
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

			<EntityListPagination search={search} total={users.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("user")}
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
							await deleteUserAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete user. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
