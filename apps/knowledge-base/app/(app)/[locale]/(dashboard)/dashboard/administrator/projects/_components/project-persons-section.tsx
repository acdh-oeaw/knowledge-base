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
import { Fragment, type ReactNode, useState, useTransition } from "react";

import { RowActionsMenu } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import {
	FormLayout,
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientTable } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-client-table";
import { deleteProjectPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_lib/delete-project-person.action";
import { upsertProjectPersonAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-persons/_lib/upsert-project-person.action";
import { dateToCalendarDate } from "@/lib/date";
import { type PersonOption, toPersonDocumentOptionsPage } from "@/lib/person-options";

interface ProjectPerson {
	id: string;
	personDocumentId: string;
	personName: string;
	roleId: string;
	roleName: string;
	durationStart: Date | null;
	durationEnd: Date | null;
}

interface ProjectPersonsSectionProps {
	projectDocumentId: string;
	persons: Array<ProjectPerson>;
	roles: Array<{ id: string; role: string }>;
}

interface DialogState {
	isOpen: boolean;
	item: ProjectPerson | null;
	person: AsyncOption | null;
	roleId: string | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: DialogState = {
	isOpen: false,
	item: null,
	person: null,
	roleId: null,
	durationStart: null,
	durationEnd: null,
};

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

	const response = await fetch(`/api/persons/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisations.");
	}

	return toPersonDocumentOptionsPage(
		(await response.json()) as { items: Array<PersonOption>; total: number },
	);
}

function formatValue(value: string): string {
	return value.replaceAll("_", " ");
}

export function ProjectPersonsSection(props: Readonly<ProjectPersonsSectionProps>): ReactNode {
	const { projectDocumentId, persons, roles } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [items, setItems] = useState(persons);

	const table = useClientTable({
		items,
		sortAccessors: {
			from: (item) => item.durationStart,
			person: (item) => item.personName,
			role: (item) => item.roleName,
			until: (item) => item.durationEnd,
		},
	});

	const [dialog, setDialog] = useState<DialogState>(emptyDialog);
	const [formState, setFormState] = useState<ActionState>(() => createActionStateInitial());
	const [itemToDelete, setItemToDelete] = useState<ProjectPerson | null>(null);
	const [isFormPending, startFormTransition] = useTransition();
	const [isDeletePending, startDeleteTransition] = useTransition();

	function openCreateDialog() {
		setFormState(createActionStateInitial());
		setDialog(emptyDialog);
		setDialog({ ...emptyDialog, isOpen: true });
	}

	function openEditDialog(item: ProjectPerson) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			person: { id: item.personDocumentId, name: item.personName },
			roleId: item.roleId,
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		const person = dialog.person;
		const role = roles.find((entry) => entry.id === dialog.roleId);

		startFormTransition(async () => {
			const newState = await upsertProjectPersonAction(formState, formData);
			setFormState(newState);

			if (newState.status === "success" && person != null && role != null) {
				const data = newState.data as { id: string } | undefined;
				const start = dialog.durationStart?.toDate("UTC") ?? null;
				const end = dialog.durationEnd?.toDate("UTC") ?? null;

				if (dialog.item != null) {
					setItems((prev) =>
						prev.map((item) =>
							item.id === dialog.item?.id
								? {
										...item,
										personDocumentId: person.id,
										personName: person.name,
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
							personDocumentId: person.id,
							personName: person.name,
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
					<FormSectionTitle title={t("Project persons")} />
				</div>

				{items.length > 0 ? (
					<Table
						aria-label="project persons"
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn allowsSorting={true} id="role" isRowHeader={true}>
								{t("Role")}
							</TableColumn>
							<TableColumn allowsSorting={true} className="max-inline-80" id="person">
								{t("Person")}
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
											<RowActionsMenu.Separator />
											<RowActionsMenu.Action
												danger={true}
												icon={<TrashIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													setItemToDelete(item);
												}}
											>
												{t("Delete person")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No project persons.")}</p>
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
						description={t("Add a person and its role in this project.")}
						title={t("Add person")}
						variant="stacked"
					>
						<Button className="self-start" onPress={openCreateDialog}>
							<PlusIcon />
							{t("Add person")}
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
					title={dialog.item == null ? t("Add person") : t("Edit person")}
					description={t("Select the person, role, and duration.")}
				/>
				<Form action={formAction} state={formState}>
					<ModalBody className="flex flex-col gap-y-4">
						{dialog.item != null ? <input name="id" type="hidden" value={dialog.item.id} /> : null}
						<input name="projectDocumentId" type="hidden" value={projectDocumentId} />
						<AsyncSelect
							aria-label={t("Person")}
							emptyMessage={t("No persons found.")}
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
				<ModalHeader
					description={t("This action cannot be undone.")}
					title={t("Delete project person")}
				/>
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
								await deleteProjectPersonAction(id);
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
