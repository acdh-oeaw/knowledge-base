"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@dariah-eric/ui/modal";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@dariah-eric/ui/table";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
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
import { deleteProjectPartnerAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-partners/_lib/delete-project-partner.action";
import { upsertProjectPartnerAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-partners/_lib/upsert-project-partner.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { ProjectPartnersResult } from "@/lib/data/project-partners";
import { dateToCalendarDate } from "@/lib/date";
import { useRouter } from "@/lib/navigation/navigation";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

interface ProjectPartnersPageProps {
	projectPartners: ProjectPartnersResult;
	roles: Array<{ id: string; role: string }>;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort: "projectName" | "roleType" | "unitName" | "unitType" | "durationStart" | "durationEnd";
}

type ProjectPartnerItem = ProjectPartnersResult["data"][number];

interface ProjectPartnerDialogState {
	isOpen: boolean;
	item: ProjectPartnerItem | null;
	project: AsyncOption | null;
	unit: AsyncOption | null;
	roleId: string | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: ProjectPartnerDialogState = {
	isOpen: false,
	item: null,
	project: null,
	unit: null,
	roleId: null,
	durationStart: null,
	durationEnd: null,
};

function formatValue(value: string): string {
	return value.replaceAll("_", " ");
}

function organisationalUnitTypeIntent(
	type: string,
): "amber" | "emerald" | "info" | "pink" | "rose" | "secondary" | "slate" | "violet" {
	switch (type) {
		case "country": {
			return "info";
		}
		case "eric": {
			return "rose";
		}
		case "governance_body": {
			return "slate";
		}
		case "institution": {
			return "emerald";
		}
		case "national_consortium": {
			return "amber";
		}
		case "regional_hub": {
			return "violet";
		}
		case "working_group": {
			return "pink";
		}
		default: {
			return "secondary";
		}
	}
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

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

async function fetchOrganisationalUnitOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisations.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

export function ProjectPartnersPage(props: Readonly<ProjectPartnersPageProps>): ReactNode {
	const {
		projectPartners,
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
		projectPartners.data,
		(state, id: string) => state.filter((item) => item.id !== id),
	);
	const [dialog, setDialog] = useState<ProjectPartnerDialogState>(emptyDialog);
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

	function openEditDialog(item: ProjectPartnerItem) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			project: {
				id: item.projectId,
				name: item.projectAcronym ?? item.projectName,
				description: item.projectName,
			},
			unit: {
				id: item.unitDocumentId,
				name: item.unitName,
				description: formatValue(item.unitType),
			},
			roleId: item.roleId,
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		startFormTransition(async () => {
			const newState = await upsertProjectPartnerAction(formState, formData);
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
				title={t("Project partners")}
				description={t("Review and manage project-to-organisation partner relations.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<Button
							className="shrink-0 whitespace-pre"
							intent="secondary"
							onPress={openCreateDialog}
						>
							<PlusIcon className="me-2 block-4 inline-4" />
							{t("Add partner")}
						</Button>
					</>
				}
			/>

			<Table
				aria-label="project partners"
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
					<TableColumn allowsSorting={true} id="unitType">
						{t("Type")}
					</TableColumn>
					<TableColumn allowsSorting={true} className="max-inline-80" id="unitName">
						{t("Partner")}
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
								<Badge intent={organisationalUnitTypeIntent(item.unitType)}>
									{formatValue(item.unitType)}
								</Badge>
							</TableCell>
							<TableCell>
								<div className="max-inline-80 truncate" title={item.unitName}>
									{item.unitName}
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
										{t("Edit partner")}
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

			<EntityListPagination search={search} total={projectPartners.total} pageSize={pageSize} />

			<ModalContent
				isOpen={dialog.isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialog(emptyDialog);
					}
				}}
			>
				<ModalHeader
					title={dialog.item == null ? t("Add partner") : t("Edit partner")}
					description={t("Select the project, partner organisation, role, and optional duration.")}
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
							aria-label={t("Partner")}
							emptyMessage={t("No organisations found.")}
							fetchPage={fetchOrganisationalUnitOptionsPage}
							initialItems={[]}
							initialTotal={0}
							isRequired={true}
							label={t("Partner")}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, unit: item };
								});
							}}
							placeholder={t("No partner selected")}
							selectedItem={dialog.unit}
						/>
						<input name="unitDocumentId" type="hidden" value={dialog.unit?.id ?? ""} />
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
				model={t("project partner")}
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
							await deleteProjectPartnerAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete project partner. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
