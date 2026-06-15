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
import { deleteProjectAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/delete-project.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface ProjectsPageProps {
	dir: "asc" | "desc";
	page: number;
	projects: {
		data: Array<
			Pick<schema.Project, "acronym" | "duration" | "funding" | "id" | "name"> & {
				documentId: string;
				entity: Pick<schema.Entity, "slug">;
				hasDraft: boolean;
				isPublished: boolean;
				scope: Pick<schema.ProjectScope, "id" | "scope">;
			}
		>;
		total: number;
	};
	q: string;
	sort: "name" | "acronym" | "funding" | "scope";
}

const pageSize = dashboardPageSize;

export function ProjectsPage(props: Readonly<ProjectsPageProps>): ReactNode {
	const { dir: initialDir, page: initialPage, projects, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(projects.data, (state, id: string) =>
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
				title={t("Projects")}
				description={t("Manage all projects in the knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/administrator/projects/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="projects"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="name" isRowHeader={true}>
						{t("Name")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="acronym">
						{t("Acronym")}
					</TableColumn>
					<TableColumn>{t("Duration")}</TableColumn>
					<TableColumn allowsSorting={true} id="funding">
						{t("Funding")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="scope">
						{t("Scope")}
					</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/administrator/projects/${item.entity.slug}/details`}>
							<TableCell>
								<div className="max-inline-64 truncate">{item.name}</div>
							</TableCell>
							<TableCell>{item.acronym}</TableCell>
							<TableCell>
								{item.duration.end
									? format.dateTimeRange(item.duration.start, item.duration.end, {
											dateStyle: "short",
										})
									: format.dateTime(item.duration.start, { dateStyle: "short" })}
							</TableCell>
							<TableCell>
								{item.funding != null
									? format.number(item.funding, { style: "currency", currency: "EUR" })
									: null}
							</TableCell>
							<TableCell>
								<Badge
									intent={
										item.scope.scope === "eu"
											? "danger"
											: item.scope.scope === "national"
												? "info"
												: "warning"
									}
								>
									{item.scope.scope}
								</Badge>
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
										href={`/dashboard/administrator/projects/${item.entity.slug}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/projects/${item.entity.slug}/edit`}
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

			<EntityListPagination search={search} total={projects.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("project")}
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
							const state = await deleteProjectAction(documentId);
							if (isActionStateError(state)) {
								const message = Array.isArray(state.message) ? state.message[0] : state.message;
								setDeleteError(message ?? t("Could not delete project. Please try again."));
								return;
							}
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete project. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
