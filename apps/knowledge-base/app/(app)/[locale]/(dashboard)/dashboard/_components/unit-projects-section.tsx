"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
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
import { Fragment, type ReactNode, useState, useTransition } from "react";

import { RowActionsMenu } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import {
	FormLayout,
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientTable } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-client-table";
import { deleteProjectPartnerAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-partners/_lib/delete-project-partner.action";
import { upsertProjectPartnerAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-partners/_lib/upsert-project-partner.action";
import { dateToCalendarDate } from "@/lib/date";

export interface UnitProject {
	id: string;
	projectId: string;
	projectName: string;
	roleId: string;
	roleName: string;
	durationStart: Date | null;
	durationEnd: Date | null;
}

interface UnitProjectsSectionProps {
	unitDocumentId: string;
	projects: Array<UnitProject>;
	roles: Array<{ id: string; role: string }>;
}

interface DialogState {
	isOpen: boolean;
	item: UnitProject | null;
	project: AsyncOption | null;
	roleId: string | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: DialogState = {
	isOpen: false,
	item: null,
	project: null,
	roleId: null,
	durationStart: null,
	durationEnd: null,
};

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

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

function formatValue(value: string): string {
	return value.replaceAll("_", " ");
}

export function UnitProjectsSection(props: Readonly<UnitProjectsSectionProps>): ReactNode {
	const { unitDocumentId, projects, roles } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [items, setItems] = useState(projects);

	const table = useClientTable({
		items,
		sortAccessors: {
			from: (item) => item.durationStart,
			project: (item) => item.projectName,
			role: (item) => item.roleName,
			until: (item) => item.durationEnd,
		},
	});

	const [dialog, setDialog] = useState<DialogState>(emptyDialog);
	const [formState, setFormState] = useState<ActionState>(() => createActionStateInitial());
	const [itemToDelete, setItemToDelete] = useState<UnitProject | null>(null);
	const [isFormPending, startFormTransition] = useTransition();
	const [isDeletePending, startDeleteTransition] = useTransition();

	function openCreateDialog() {
		setFormState(createActionStateInitial());
		setDialog({ ...emptyDialog, isOpen: true });
	}

	function openEditDialog(item: UnitProject) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			project: { id: item.projectId, name: item.projectName },
			roleId: item.roleId,
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		const project = dialog.project;
		const role = roles.find((entry) => entry.id === dialog.roleId);

		startFormTransition(async () => {
			const newState = await upsertProjectPartnerAction(formState, formData);
			setFormState(newState);

			if (newState.status === "success" && project != null && role != null) {
				const data = newState.data as { id: string } | undefined;
				const start = dialog.durationStart?.toDate("UTC") ?? null;
				const end = dialog.durationEnd?.toDate("UTC") ?? null;

				if (dialog.item != null) {
					setItems((prev) =>
						prev.map((item) =>
							item.id === dialog.item?.id
								? {
										...item,
										projectId: project.id,
										projectName: project.name,
										roleId: role.id,
										roleName: role.role,
										durationStart: start,
										durationEnd: end,
									}
								: item,
						),
					);
				} else if (data != null) {
					setItems((prev) => [
						...prev,
						{
							id: data.id,
							projectId: project.id,
							projectName: project.name,
							roleId: role.id,
							roleName: role.role,
							durationStart: start,
							durationEnd: end,
						},
					]);
				}

				setDialog(emptyDialog);
			}
		});
	}

	return (
		<Fragment>
			<div className="max-inline-3xl space-y-6">
				<div className="space-y-1">
					<FormSectionTitle title={t("Projects")} />
				</div>

				{items.length > 0 ? (
					<Table
						aria-label="projects"
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn allowsSorting={true} id="role" isRowHeader={true}>
								{t("Role")}
							</TableColumn>
							<TableColumn allowsSorting={true} className="max-inline-80" id="project">
								{t("Project")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="from">
								{t("From")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="until">
								{t("Until")}
							</TableColumn>
							<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
						</TableHeader>
						<TableBody items={table.pageItems}>
							{(item) => (
								<TableRow id={item.id}>
									<TableCell>{formatValue(item.roleName)}</TableCell>
									<TableCell>
										<div className="max-inline-80 truncate" title={item.projectName}>
											{item.projectName}
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
												{t("Edit project")}
											</RowActionsMenu.Action>
											<RowActionsMenu.Separator />
											<RowActionsMenu.Action
												danger={true}
												icon={<TrashIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													setItemToDelete(item);
												}}
											>
												{t("Delete project")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No projects.")}</p>
				)}

				{table.totalPages > 1 && (
					<Paginate
						page={table.page}
						setPage={table.setPage}
						total={table.totalPages}
						totalItems={table.total}
					/>
				)}

				<FormLayout variant="stacked">
					<FormSection
						description={t("Add a project this unit participates in and its role.")}
						title={t("Add project")}
						variant="stacked"
					>
						<Button className="self-start" onPress={openCreateDialog}>
							<PlusIcon />
							{t("Add project")}
						</Button>
					</FormSection>
				</FormLayout>
			</div>

			<ModalContent
				isOpen={dialog.isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialog(emptyDialog);
					}
				}}
			>
				<ModalHeader
					title={dialog.item == null ? t("Add project") : t("Edit project")}
					description={t("Select the project, role, and optional duration.")}
				/>
				<Form action={formAction} state={formState}>
					<ModalBody className="flex flex-col gap-y-4">
						{dialog.item != null ? <input name="id" type="hidden" value={dialog.item.id} /> : null}
						<input name="unitDocumentId" type="hidden" value={unitDocumentId} />
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

			<ModalContent
				isOpen={itemToDelete != null}
				onOpenChange={(open) => {
					if (!open) {
						setItemToDelete(null);
					}
				}}
				role="alertdialog"
				size="sm"
			>
				<ModalHeader description={t("This action cannot be undone.")} title={t("Delete project")} />
				<ModalFooter>
					<ModalClose>{t("Cancel")}</ModalClose>
					<Button
						intent="danger"
						isPending={isDeletePending}
						onPress={() => {
							if (itemToDelete == null) {
								return;
							}

							const id = itemToDelete.id;
							startDeleteTransition(async () => {
								await deleteProjectPartnerAction(id);
								setItems((prev) => prev.filter((item) => item.id !== id));
								setItemToDelete(null);
							});
						}}
					>
						{t("Delete")}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Fragment>
	);
}
