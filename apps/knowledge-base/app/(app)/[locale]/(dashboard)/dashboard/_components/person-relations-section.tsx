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
import type { AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
import { ArchiveBoxXMarkIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { CalendarDate } from "@internationalized/date";
import { useExtracted, useFormatter } from "next-intl";
import { Fragment, type ReactNode, startTransition, useState, useTransition } from "react";

import { RowActionsMenu } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-list";
import {
	FormLayout,
	FormSection,
	FormSectionTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import { Paginate } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/paginate";
import { useClientTable } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/use-client-table";
import { createContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-contribution.action";
import { endContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/end-contribution.action";
import { updateContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-contribution.action";
import { deleteContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/contributions/_lib/delete-contribution.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import type { PersonRelation, PersonRelationRoleOption } from "@/lib/data/person-relations";
import { dateToCalendarDate } from "@/lib/date";

interface PersonRelationsSectionProps {
	organisationalUnitDocumentId: string;
	relations: Array<PersonRelation & { lifecycleStatus?: "changed" | "new" }>;
	roleOptions: Array<PersonRelationRoleOption>;
	initialPersonItems: Array<ContributionPersonOption>;
	initialPersonTotal: number;
}

async function fetchPersonOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<ContributionPersonOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		resource: "persons",
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/contributions/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load persons.");
	}

	return (await response.json()) as { items: Array<ContributionPersonOption>; total: number };
}

function formatRoleType(type: string): string {
	return type.replaceAll("_", " ");
}

function formatUnitType(type: string): string {
	return type.replaceAll("_", " ");
}

function formatLifecycleStatus(
	status: "changed" | "new",
	t: ReturnType<typeof useExtracted>,
): string {
	return status === "new" ? t("New") : t("Changed");
}

export function PersonRelationsSection(props: Readonly<PersonRelationsSectionProps>): ReactNode {
	const {
		organisationalUnitDocumentId,
		relations,
		roleOptions,
		initialPersonItems,
		initialPersonTotal,
	} = props;

	const t = useExtracted();
	const format = useFormatter();

	const [localRelations, setLocalRelations] = useState(relations);
	const [itemToEnd, setItemToEnd] = useState<{ id: string } | null>(null);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [selectedEndDate, setSelectedEndDate] = useState<CalendarDate | null>(null);

	const [selectedRoleTypeId, setSelectedRoleTypeId] = useState<string | null>(null);
	const [selectedPerson, setSelectedPerson] = useState<ContributionPersonOption | null>(null);

	const [itemToEdit, setItemToEdit] = useState<PersonRelation | null>(null);
	const [editRoleTypeId, setEditRoleTypeId] = useState<string | null>(null);
	const [editPerson, setEditPerson] = useState<ContributionPersonOption | null>(null);
	const [editStartDate, setEditStartDate] = useState<CalendarDate | null>(null);
	const [editEndDate, setEditEndDate] = useState<CalendarDate | null>(null);

	const table = useClientTable({
		items: localRelations,
		sortAccessors: {
			from: (relation) => relation.duration.start,
			person: (relation) => relation.personSortName,
			role: (relation) => relation.roleType,
			type: (relation) => relation.targetUnitType,
			until: (relation) => relation.duration.end,
		},
	});

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [editState, setEditState] = useState<ActionState>(() => createActionStateInitial());
	const [isPending, startFormTransition] = useTransition();
	const [isEditPending, startEditTransition] = useTransition();

	const validationErrors = state.status === "error" ? state.validationErrors : undefined;
	const selectedRoleOption = roleOptions.find((option) => option.roleTypeId === selectedRoleTypeId);
	const editValidationErrors =
		editState.status === "error" ? editState.validationErrors : undefined;
	const editRoleOption = roleOptions.find((option) => option.roleTypeId === editRoleTypeId);

	function formAction(formData: FormData) {
		const person = selectedPerson;
		const option = selectedRoleOption;

		startFormTransition(async () => {
			const newState = await createContributionAction(state, formData);
			setState(newState);

			if (newState.status === "success" && option != null && person != null) {
				const data = newState.data as
					| {
							id: string;
							durationStart: string;
							durationEnd: string | null;
							targetUnitType: PersonRelation["targetUnitType"];
							personSlug: PersonRelation["personSlug"];
					  }
					| undefined;

				if (data != null) {
					setLocalRelations((prev) => [
						...prev,
						{
							id: data.id,
							personDocumentId: person.id,
							personName: person.name,
							personSortName: person.sortName,
							personSlug: data.personSlug,
							roleTypeId: option.roleTypeId,
							roleType: option.roleType as PersonRelation["roleType"],
							targetUnitType: data.targetUnitType,
							duration: {
								start: new Date(data.durationStart),
								...(data.durationEnd != null ? { end: new Date(data.durationEnd) } : {}),
							},
						},
					]);
				}

				setSelectedRoleTypeId(null);
				setSelectedPerson(null);
			}
		});
	}

	function openEditDialog(relation: PersonRelation) {
		setEditState(createActionStateInitial());
		setItemToEdit(relation);
		setEditRoleTypeId(relation.roleTypeId);
		setEditPerson({
			id: relation.personDocumentId,
			name: relation.personName,
			sortName: relation.personSortName,
		});
		setEditStartDate(dateToCalendarDate(relation.duration.start));
		setEditEndDate(dateToCalendarDate(relation.duration.end));
	}

	function editFormAction(formData: FormData) {
		const person = editPerson;
		const option = editRoleOption;

		startEditTransition(async () => {
			const newState = await updateContributionAction(editState, formData);
			setEditState(newState);

			if (newState.status === "success" && itemToEdit != null && option != null && person != null) {
				const start = editStartDate?.toDate("UTC") ?? itemToEdit.duration.start;
				const end = editEndDate?.toDate("UTC") ?? undefined;

				setLocalRelations((prev) =>
					prev.map((relation) =>
						relation.id === itemToEdit.id
							? {
									...relation,
									personDocumentId: person.id,
									personName: person.name,
									personSortName: person.sortName,
									roleTypeId: option.roleTypeId,
									roleType: option.roleType as PersonRelation["roleType"],
									duration: { start, ...(end != null ? { end } : {}) },
								}
							: relation,
					),
				);
				setItemToEdit(null);
			}
		});
	}

	return (
		<Fragment>
			<div className="max-inline-3xl space-y-6">
				<div className="space-y-1">
					<FormSectionTitle title={t("People")} />
				</div>

				{localRelations.length > 0 ? (
					<Table
						aria-label="people"
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn
								allowsSorting={true}
								className="max-inline-80"
								id="person"
								isRowHeader={true}
							>
								{t("Person")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="type">
								{t("Type")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="role">
								{t("Role")}
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
							{(relation) => (
								<TableRow id={relation.id}>
									<TableCell>
										<div className="max-inline-80 truncate" title={relation.personName}>
											{relation.personName}
										</div>
									</TableCell>
									<TableCell>
										<Badge intent="slate">{formatUnitType(relation.targetUnitType)}</Badge>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-x-2">
											<span>{formatRoleType(relation.roleType)}</span>
											{relation.lifecycleStatus != null && (
												<Badge intent={relation.lifecycleStatus === "new" ? "emerald" : "amber"}>
													{formatLifecycleStatus(relation.lifecycleStatus, t)}
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										{format.dateTime(relation.duration.start, { dateStyle: "short" })}
									</TableCell>
									<TableCell>
										{relation.duration.end != null
											? format.dateTime(relation.duration.end, { dateStyle: "short" })
											: t("present")}
									</TableCell>
									<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
										<RowActionsMenu>
											<RowActionsMenu.Action
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													openEditDialog(relation);
												}}
											>
												{t("Edit person relation")}
											</RowActionsMenu.Action>
											{relation.duration.end == null && (
												<RowActionsMenu.Action
													icon={<ArchiveBoxXMarkIcon className="me-2 block-4 inline-4" />}
													onAction={() => {
														setItemToEnd({ id: relation.id });
														setSelectedEndDate(null);
													}}
												>
													{t("End person relation")}
												</RowActionsMenu.Action>
											)}
											<RowActionsMenu.Separator />
											<RowActionsMenu.Action
												danger={true}
												icon={<TrashIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													setItemToDelete({ id: relation.id });
												}}
											>
												{t("Delete person relation")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No people assigned.")}</p>
				)}

				{table.totalPages > 1 && (
					<Paginate
						page={table.page}
						setPage={table.setPage}
						total={table.totalPages}
						totalItems={table.total}
					/>
				)}

				{roleOptions.length > 0 && (
					<FormLayout variant="stacked">
						<Form action={formAction} className="flex flex-col gap-y-6" state={state}>
							<FormSection
								description={t("Add a person to this organisational unit.")}
								title={t("Add person")}
								variant="stacked"
							>
								<Select
									isRequired={true}
									onChange={(key) => {
										setSelectedRoleTypeId(String(key));
									}}
									value={selectedRoleTypeId}
								>
									<Label>{t("Role")}</Label>
									<SelectTrigger />
									<FieldError />
									<SelectContent>
										{roleOptions.map((option) => (
											<SelectItem key={option.roleTypeId} id={option.roleTypeId}>
												{formatRoleType(option.roleType)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<input name="roleTypeId" type="hidden" value={selectedRoleTypeId ?? ""} />

								<AsyncSelect
									aria-label={t("Person")}
									emptyMessage={t("No persons found.")}
									errorMessage={
										typeof validationErrors?.personDocumentId === "string"
											? validationErrors.personDocumentId
											: undefined
									}
									fetchPage={fetchPersonOptionsPage}
									initialItems={initialPersonItems}
									initialTotal={initialPersonTotal}
									isRequired={true}
									label={t("Person")}
									onSelect={setSelectedPerson}
									placeholder={t("No person selected")}
									selectedItem={selectedPerson}
								/>
								<input name="personDocumentId" type="hidden" value={selectedPerson?.id ?? ""} />

								<DatePicker granularity="day" isRequired={true} name="duration.start">
									<Label>{t("Start date")}</Label>
									<DatePickerTrigger />
									<FieldError />
								</DatePicker>

								<DatePicker granularity="day" name="duration.end">
									<Label>{t("End date")}</Label>
									<DatePickerTrigger />
									<FieldError />
								</DatePicker>

								<input
									name="organisationalUnitDocumentId"
									type="hidden"
									value={organisationalUnitDocumentId}
								/>
							</FormSection>

							<Button className="self-start" isPending={isPending} type="submit">
								{isPending ? (
									<Fragment>
										<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
										<span aria-hidden={true}>{t("Saving...")}</span>
									</Fragment>
								) : (
									t("Add person")
								)}
							</Button>

							<FormStatus className="self-start" state={state} />
						</Form>
					</FormLayout>
				)}
			</div>

			<ModalContent
				isOpen={itemToEnd != null}
				onOpenChange={(open) => {
					if (!open) {
						setItemToEnd(null);
					}
				}}
				role="alertdialog"
				size="sm"
			>
				<ModalHeader
					description={t("Set the date on which this person relation ended.")}
					title={t("End person relation")}
				/>
				<ModalBody>
					<DatePicker
						granularity="day"
						onChange={(date) => {
							setSelectedEndDate(date);
						}}
						value={selectedEndDate}
					>
						<Label>{t("End date")}</Label>
						<DatePickerTrigger />
					</DatePicker>
				</ModalBody>
				<ModalFooter>
					<ModalClose>{t("Cancel")}</ModalClose>
					<Button
						isDisabled={selectedEndDate == null}
						onPress={() => {
							if (itemToEnd == null || selectedEndDate == null) {
								return;
							}

							const end = selectedEndDate.toDate("UTC");

							startTransition(async () => {
								await endContributionAction(itemToEnd.id, end);
								setLocalRelations((prev) =>
									prev.map((relation) =>
										relation.id === itemToEnd.id
											? { ...relation, duration: { ...relation.duration, end } }
											: relation,
									),
								);
								setItemToEnd(null);
							});
						}}
					>
						{t("Confirm")}
					</Button>
				</ModalFooter>
			</ModalContent>

			<ModalContent
				isOpen={itemToEdit != null}
				onOpenChange={(open) => {
					if (!open) {
						setItemToEdit(null);
					}
				}}
			>
				<ModalHeader
					description={t("Update the person, role, and duration.")}
					title={t("Edit person relation")}
				/>
				<Form action={editFormAction} state={editState}>
					<ModalBody className="flex flex-col gap-y-4">
						<input name="id" type="hidden" value={itemToEdit?.id ?? ""} />
						<input
							name="organisationalUnitDocumentId"
							type="hidden"
							value={organisationalUnitDocumentId}
						/>
						<Select
							isRequired={true}
							onChange={(key) => {
								setEditRoleTypeId(String(key));
							}}
							value={editRoleTypeId}
						>
							<Label>{t("Role")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{roleOptions.map((option) => (
									<SelectItem key={option.roleTypeId} id={option.roleTypeId}>
										{formatRoleType(option.roleType)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="roleTypeId" type="hidden" value={editRoleTypeId ?? ""} />
						<AsyncSelect
							aria-label={t("Person")}
							emptyMessage={t("No persons found.")}
							errorMessage={
								typeof editValidationErrors?.personDocumentId === "string"
									? editValidationErrors.personDocumentId
									: undefined
							}
							fetchPage={fetchPersonOptionsPage}
							initialItems={initialPersonItems}
							initialTotal={initialPersonTotal}
							isRequired={true}
							label={t("Person")}
							onSelect={setEditPerson}
							placeholder={t("No person selected")}
							selectedItem={editPerson}
						/>
						<input name="personDocumentId" type="hidden" value={editPerson?.id ?? ""} />
						<DatePicker
							granularity="day"
							isRequired={true}
							name="duration.start"
							onChange={(date) => {
								setEditStartDate(date);
							}}
							value={editStartDate}
						>
							<Label>{t("Start date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
						<DatePicker
							granularity="day"
							name="duration.end"
							onChange={(date) => {
								setEditEndDate(date);
							}}
							value={editEndDate}
						>
							<Label>{t("End date")}</Label>
							<DatePickerTrigger />
							<FieldError />
						</DatePicker>
						<FormStatus className="self-start" state={editState} />
					</ModalBody>
					<ModalFooter>
						<ModalClose>{t("Cancel")}</ModalClose>
						<Button isPending={isEditPending} type="submit">
							{isEditPending ? (
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
					description={t("This will permanently delete this person relation.")}
					title={t("Delete person relation")}
				/>
				<ModalFooter>
					<ModalClose>{t("Cancel")}</ModalClose>
					<Button
						intent="danger"
						onPress={() => {
							if (itemToDelete == null) {
								return;
							}

							const id = itemToDelete.id;
							startTransition(async () => {
								await deleteContributionAction(id);
								setLocalRelations((prev) => prev.filter((relation) => relation.id !== id));
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
