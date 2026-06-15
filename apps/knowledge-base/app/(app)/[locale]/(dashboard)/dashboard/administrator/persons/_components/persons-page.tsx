"use client";

import type * as schema from "@acdh-knowledge-base/database/schema";
import { isActionStateError } from "@acdh-knowledge-base/next-lib/actions";
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
import { deletePersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/delete-person.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface PersonsPageProps {
	dir: "asc" | "desc";
	page: number;
	persons: {
		data: Array<
			Pick<schema.Person, "email" | "id" | "name" | "orcid"> & {
				documentId: string;
				entity: Pick<schema.Entity, "slug">;
				hasDraft: boolean;
				isPublished: boolean;
			}
		>;
		total: number;
	};
	q: string;
	sort: "name" | "email" | "orcid";
}

const pageSize = dashboardPageSize;

export function PersonsPage(props: Readonly<PersonsPageProps>): ReactNode {
	const { dir: initialDir, page: initialPage, persons, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(persons.data, (state, id: string) =>
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
				title={t("Persons")}
				description={t("Manage all persons in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/persons/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="persons"
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
					<TableColumn allowsSorting={true} id="orcid">
						{t("ORCID")}
					</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/administrator/persons/${item.entity.slug}/details`}>
							<TableCell>{item.name}</TableCell>
							<TableCell>{item.email}</TableCell>
							<TableCell>{item.orcid}</TableCell>
							<TableCell>
								<EntityLifecycleStatusBadge
									hasDraft={item.hasDraft}
									isPublished={item.isPublished}
								/>
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/persons/${item.entity.slug}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/persons/${item.entity.slug}/edit`}
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

			<EntityListPagination search={search} total={persons.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("person")}
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
							const state = await deletePersonAction(documentId);
							if (isActionStateError(state)) {
								const message = Array.isArray(state.message) ? state.message[0] : state.message;
								setDeleteError(message ?? t("Could not delete person. Please try again."));
								return;
							}
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete person. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
