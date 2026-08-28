"use client";

import type * as schema from "@dariah-eric/database/schema";
import { isActionStateError } from "@dariah-eric/next-lib/actions";
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
import { deleteEventAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/delete-event.action";
import { dashboardPageSize } from "@/config/pagination.config";
import { useRouter } from "@/lib/navigation/navigation";

interface EventsPageProps {
	dir: "asc" | "desc";
	events: {
		data: Array<
			Pick<
				schema.Event,
				"id" | "duration" | "isFullDay" | "location" | "title" | "summary" | "website"
			> & {
				documentId: string;
				entity: { slug: string };
				hasDraft: boolean;
				isPublished: boolean;
			}
		>;
		total: number;
	};
	page: number;
	q: string;
	sort: "duration" | "title";
}

const pageSize = dashboardPageSize;

export function EventsPage(props: Readonly<EventsPageProps>): ReactNode {
	const { dir: initialDir, events, page: initialPage, q: initialQ, sort: initialSort } = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(events.data, (state, id: string) =>
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
				title={t("Events")}
				description={t("Manage all events in the DARIAH knowledge base.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<NewLink href="/dashboard/website/events/create">{t("New")}</NewLink>
					</>
				}
			/>

			<Table
				aria-label="events"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn allowsSorting={true} id="title" isRowHeader={true}>
						{t("Title")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="duration">
						{t("Duration")}
					</TableColumn>
					<TableColumn>{t("Location")}</TableColumn>
					<TableColumn>{t("Status")}</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow href={`/dashboard/website/events/${item.entity.slug}/details`}>
							<TableCell>
								<EntityListTitle title={item.title} />
							</TableCell>
							<TableCell>
								{item.duration.end != null
									? format.dateTimeRange(
											item.duration.start,
											item.duration.end,
											item.isFullDay
												? { dateStyle: "short" }
												: { dateStyle: "short", timeStyle: "short" },
										)
									: format.dateTime(
											item.duration.start,
											item.isFullDay
												? { dateStyle: "short" }
												: { dateStyle: "short", timeStyle: "short" },
										)}
							</TableCell>
							<TableCell>{item.location}</TableCell>
							<TableCell>
								<EntityLifecycleStatusBadge
									hasDraft={item.hasDraft}
									isPublished={item.isPublished}
								/>
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
								<RowActionsMenu>
									<RowActionsMenu.Link
										href={`/dashboard/website/events/${item.entity.slug}/details`}
										icon={<EyeIcon className="me-2 block-4 inline-4" />}
									>
										{t("View")}
									</RowActionsMenu.Link>
									<RowActionsMenu.Link
										href={`/dashboard/website/events/${item.entity.slug}/edit`}
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

			<EntityListPagination search={search} total={events.total} pageSize={pageSize} />

			<EntityDeleteModal
				item={itemToDelete}
				model={t("event")}
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
							const state = await deleteEventAction(documentId);
							if (isActionStateError(state)) {
								const message = Array.isArray(state.message) ? state.message[0] : state.message;
								setDeleteError(message ?? t("Could not delete event. Please try again."));
								return;
							}
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete event. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
