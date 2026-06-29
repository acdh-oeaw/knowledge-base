"use client";

import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { AsyncSelect } from "@acdh-knowledge-base/ui/async-select";
import { Button } from "@acdh-knowledge-base/ui/button";
import { DatePicker, DatePickerTrigger } from "@acdh-knowledge-base/ui/date-picker";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@acdh-knowledge-base/ui/modal";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@acdh-knowledge-base/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@acdh-knowledge-base/ui/table";
import type {
	AsyncOption,
	AsyncOptionsFetchPageParams,
} from "@acdh-knowledge-base/ui/use-async-options";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { CalendarDate } from "@internationalized/date";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, useOptimistic, useState, useTransition } from "react";

import {
	EntityDeleteModal,
	EntityListHeader,
	EntityListPagination,
	EntityListSearchField,
	RowActionsMenu,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import { useUrlPaginatedSearch } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-url-paginated-search";
import { deleteProjectPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_lib/delete-project-person.action";
import { upsertProjectPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_lib/upsert-project-person.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { ProjectPersonsResult } from "@/lib/data/project-persons";
import { dateToCalendarDate } from "@/lib/date";
import { useRouter } from "@/lib/navigation/navigation";
import { type PersonOption, toPersonDocumentOptionsPage } from "@/lib/person-options";

interface ProjectPersonsPageProps {
	projectPersons: ProjectPersonsResult;
	roles: Array<{ id: string; role: string }>;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort: "projectName" | "roleType" | "personName" | "durationStart" | "durationEnd";
}

type ProjectPersonItem = ProjectPersonsResult["data"][number];

interface ProjectPersonDialogState {
	isOpen: boolean;
	item: ProjectPersonItem | null;
	project: AsyncOption | null;
	person: AsyncOption | null;
	roleId: string | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: ProjectPersonDialogState = {
	isOpen: false,
	item: null,
	project: null,
	person: null,
	roleId: null,
	durationStart: null,
	durationEnd: null,
};

function formatValue(value: string): string {
	return value.replaceAll("_", " ");
}

const pageSize = dashboardPageSize;

async function fetchProjectOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/projects/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load projects.");
	}

	return toPersonDocumentOptionsPage(
		(await response.json()) as { items: Array<PersonOption>; total: number },
	);
}

async function fetchPersonOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/person/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisations.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

export function ProjectPersonsPage(props: Readonly<ProjectPersonsPageProps>): ReactNode {
	const {
		projectPersons,
		roles,
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(
		projectPersons.data,
		(state, id: string) => state.filter((item) => item.id !== id),
	);
	const [dialog, setDialog] = useState<ProjectPersonDialogState>(emptyDialog);
	const [formState, setFormState] = useState<ActionState>(() => createActionStateInitial());
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const search = useUrlPaginatedSearch({
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	});
	const [isFormPending, startFormTransition] = useTransition();
	const [isDeletePending, startDeleteTransition] = useTransition();

	function openCreateDialog() {
		setFormState(createActionStateInitial());
		setDialog({ ...emptyDialog, isOpen: true });
	}

	function openEditDialog(item: ProjectPersonItem) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			project: {
				id: item.projectId,
				name: item.projectAcronym ?? item.projectName,
				description: item.projectName,
			},
			person: {
				id: item.personDocumentId,
				name: item.personName,
				description: item.personName,
			},
			roleId: item.roleId,
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		startFormTransition(async () => {
			const newState = await upsertProjectPersonAction(formState, formData);
			setFormState(newState);

			if (newState.status === "success") {
				setDialog(emptyDialog);
				router.refresh();
			}
		});
	}

	return (
		<Fragment>
			<EntityListHeader
				title={t("Project persons")}
				description={t("Review and manage project-to-person person relations.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<Button
							className="shrink-0 whitespace-pre"
							intent="secondary"
							onPress={openCreateDialog}
						>
							<PlusIcon className="me-2 block-4 inline-4" />
							{t("Add person")}
						</Button>
					</>
				}
			/>

			<Table
				aria-label="project persons"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn
						allowsSorting={true}
						className="max-inline-80"
						id="projectName"
						isRowHeader={true}
					>
						{t("Project")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="roleType">
						{t("Role")}
					</TableColumn>
					<TableColumn allowsSorting={true} className="max-inline-80" id="personName">
						{t("Person")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="durationStart">
						{t("From")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="durationEnd">
						{t("Until")}
					</TableColumn>
					<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
				</TableHeader>
				<TableBody items={items}>
					{(item) => (
						<TableRow id={item.id}>
							<TableCell>
								<div className="max-inline-80 truncate" title={item.projectName}>
									{item.projectAcronym ?? item.projectName}
								</div>
							</TableCell>
							<TableCell>{formatValue(item.roleType)}</TableCell>
							<TableCell>
								<div className="max-inline-80 truncate" title={item.personName}>
									{item.personName}
								</div>
							</TableCell>
							<TableCell>
								{item.durationStart != null
									? format.dateTime(item.durationStart, { dateStyle: "short" })
									: "—"}
							</TableCell>
							<TableCell>
								{item.durationEnd != null
									? format.dateTime(item.durationEnd, { dateStyle: "short" })
									: item.durationStart != null
										? t("present")
										: "—"}
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Action
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
										onAction={() => {
											openEditDialog(item);
										}}
									>
										{t("Edit person")}
									</RowActionsMenu.Action>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/projects/${item.projectSlug}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit project")}
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

			<EntityListPagination search={search} total={projectPersons.total} pageSize={pageSize} />

			<ModalContent
				isOpen={dialog.isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialog(emptyDialog);
					}
				}}
			>
				<ModalHeader
					title={dialog.item == null ? t("Add person") : t("Edit person")}
					description={t("Select the project, person, role, and duration.")}
				/>
				<Form action={formAction} state={formState}>
					<ModalBody className="flex flex-col gap-y-4">
						{dialog.item != null ? <input name="id" type="hidden" value={dialog.item.id} /> : null}
						<AsyncSelect
							aria-label={t("Project")}
							emptyMessage={t("No projects found.")}
							fetchPage={fetchProjectOptionsPage}
							initialItems={[]}
							initialTotal={0}
							isRequired={true}
							label={t("Project")}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, project: item };
								});
							}}
							placeholder={t("No project selected")}
							selectedItem={dialog.project}
						/>
						<input name="projectDocumentId" type="hidden" value={dialog.project?.id ?? ""} />
						<AsyncSelect
							aria-label={t("Person")}
							emptyMessage={t("No organisations found.")}
							fetchPage={fetchPersonOptionsPage}
							initialItems={[]}
							initialTotal={0}
							isRequired={true}
							label={t("Person")}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, person: item };
								});
							}}
							placeholder={t("No person selected")}
							selectedItem={dialog.person}
						/>
						<input name="personDocumentId" type="hidden" value={dialog.person?.id ?? ""} />
						<Select
							isRequired={true}
							onChange={(key) => {
								setDialog((prev) => {
									return { ...prev, roleId: String(key) };
								});
							}}
							value={dialog.roleId}
						>
							<Label>{t("Role")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{roles.map((role) => (
									<SelectItem key={role.id} id={role.id}>
										{formatValue(role.role)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="roleId" type="hidden" value={dialog.roleId ?? ""} />
						<DatePicker
							granularity="day"
							name="duration.start"
							onChange={(date) => {
								setDialog((prev) => {
									return { ...prev, durationStart: date };
								});
							}}
							value={dialog.durationStart}
						>
							<Label>{t("Start date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
						<DatePicker
							granularity="day"
							name="duration.end"
							onChange={(date) => {
								setDialog((prev) => {
									return { ...prev, durationEnd: date };
								});
							}}
							value={dialog.durationEnd}
						>
							<Label>{t("End date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
						<FormStatus state={formState} />
					</ModalBody>
					<ModalFooter>
						<ModalClose>{t("Cancel")}</ModalClose>
						<Button isPending={isFormPending} type="submit">
							{isFormPending ? (
								<Fragment>
									<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
									<span aria-hidden={true}>{t("Saving...")}</span>
								</Fragment>
							) : (
								t("Save")
							)}
						</Button>
					</ModalFooter>
				</Form>
			</ModalContent>

			<EntityDeleteModal
				item={itemToDelete}
				model={t("project person")}
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
							await deleteProjectPersonAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete project person. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
