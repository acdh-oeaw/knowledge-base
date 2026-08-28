"use client";

import { Badge } from "@dariah-eric/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import { PencilSquareIcon, TrashIcon, UserIcon } from "@heroicons/react/24/outline";
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
import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { deleteUserAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/delete-user.action";
import { startImpersonationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/start-impersonation.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { UsersResult } from "@/lib/data/users";
import { getEntityDetailHref } from "@/lib/entity-detail-href";
import { getEntityTypeLabel } from "@/lib/entity-type-label";
import { useRouter } from "@/lib/navigation/navigation";

interface UsersPageProps {
	currentUserCanManageAdmins: boolean;
	currentUserId: string;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort: "name" | "email" | "role" | "canManageAdmins" | "isEmailVerified";
	users: {
		data: UsersResult["data"];
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
	const [, startImpersonationTransition] = useTransition();

	return (
		<Fragment>
			<EntityListHeader
				title={t("Users")}
				description={t("Manage all users in the DARIAH knowledge base.")}
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
					<TableColumn id="actor">{t("Linked actor")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow id={item.id}>
							<TableCell>{item.name}</TableCell>
							<TableCell>{item.email}</TableCell>
							<TableCell>
								<Badge intent={item.role === "admin" ? "primary" : "secondary"}>
									{item.role === "admin" ? t("Admin") : t("User")}
								</Badge>
							</TableCell>
							<TableCell>
								<Badge intent={item.canManageAdmins ? "info" : "secondary"}>
									{item.canManageAdmins ? t("Yes") : t("No")}
								</Badge>
							</TableCell>
							<TableCell>
								<Badge intent={item.isEmailVerified ? "success" : "warning"}>
									{item.isEmailVerified ? t("Yes") : t("No")}
								</Badge>
							</TableCell>
							<TableCell>
								{item.actor != null ? (
									<span className="inline-flex items-center gap-x-2">
										<RelationLink href={getEntityDetailHref(item.actor)}>
											{item.actor.name}
										</RelationLink>
										<Badge intent="slate">{getEntityTypeLabel(item.actor)}</Badge>
									</span>
								) : null}
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
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
										icon={<UserIcon className="me-2 block-4 inline-4" />}
										/**
										 * Admin accounts are excluded by the auth service too; disabling here only
										 * saves the round trip.
										 */
										isDisabled={item.id === currentUserId || item.role === "admin"}
										onAction={() => {
											startImpersonationTransition(async () => {
												await startImpersonationAction(item.id);
											});
										}}
									>
										{t("Sign in as this user")}
									</RowActionsMenu.Action>
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
