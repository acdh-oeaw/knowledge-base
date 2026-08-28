"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { AsyncSelect } from "@dariah-eric/ui/async-select";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { DatePicker, DatePickerTrigger } from "@dariah-eric/ui/date-picker";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
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
import { TextField } from "@dariah-eric/ui/text-field";
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@dariah-eric/ui/use-async-options";
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
import type { OrganisationalUnitType } from "@/lib/data/organisational-units";
import type { ReverseUnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";
import { dateToCalendarDate } from "@/lib/date";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";
import type { ServerAction } from "@/lib/server/create-server-action";

/**
 * The mutations this section performs, injected by the caller so the same UI can be wired to either
 * the admin actions (`requireAdmin`) or the delegated, scope-authorized actions used on non-admin
 * dashboards.
 */
export interface UnitRelationActions {
	create: ServerAction;
	update: ServerAction;
	end: (id: string, end: Date) => Promise<void>;
	delete: (id: string) => Promise<void>;
}

/** Core, editable metadata of a source unit, used by the optional create/edit affordances. */
export interface EditableUnitFields {
	name: string;
	acronym: string | null;
	ror: string | null;
	summary: string | null;
}

/**
 * Optional affordance to create a new source unit (e.g. an institution) inline and select it. The
 * action receives the unit's core fields plus a hidden `scopeDocumentId`, and must return `{ id,
 * name }`.
 */
export interface CreateSourceUnit {
	action: ServerAction;
	/**
	 * Passed as a hidden `scopeDocumentId` field for the action to authorize against (e.g. the
	 * country).
	 */
	scopeDocumentId: string;
	buttonLabel: string;
	title: string;
}

/** Optional affordance to edit an existing source unit's own metadata from its row. */
export interface EditSourceUnit {
	updateAction: ServerAction;
	getFields: (documentId: string) => Promise<EditableUnitFields | null>;
	rowActionLabel: string;
	title: string;
}

interface ReverseUnitRelationsSectionProps {
	/** The current unit's document id — the fixed _target_ of every relation shown here. */
	relatedUnitDocumentId: string;
	relations: Array<ReverseUnitRelation>;
	statusOptions: Array<UnitRelationStatusOption>;
	/** Organisational-unit type to pick as the relation's source/owner (e.g. "institution"). */
	sourceUnitType: OrganisationalUnitType;
	/**
	 * Restrict the source-unit picker to units `is_located_in` this country document id. Used to
	 * scope, for example, a country edit form to its own institutions.
	 */
	sourceUnitLocatedInCountryDocumentId?: string;
	/** When true, the source-unit picker also offers draft units (e.g. ones the caller just created). */
	includeDraftSourceUnits?: boolean;
	/** Entity-specific copy, kept in the parent so message extraction works. */
	messages: {
		title: string;
		/** Singular noun for the source unit, used as column header and picker label. */
		memberLabel: string;
		empty: string;
		addButton: string;
	};
	actions: UnitRelationActions;
	createSourceUnit?: CreateSourceUnit;
	editSourceUnit?: EditSourceUnit;
}

async function fetchSourceUnitOptionsPage(
	unitType: string,
	params: Readonly<AsyncOptionsFetchPageParams>,
	locatedInCountryDocumentId?: string,
	includeDrafts = false,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		unitType,
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	if (locatedInCountryDocumentId != null) {
		searchParams.set("locatedInCountryDocumentId", locatedInCountryDocumentId);
	}

	if (includeDrafts) {
		searchParams.set("includeDrafts", "true");
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load units.");
	}

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

function formatStatus(type: string): string {
	return type.replaceAll("_", " ");
}

export function ReverseUnitRelationsSection(
	props: Readonly<ReverseUnitRelationsSectionProps>,
): ReactNode {
	const {
		relatedUnitDocumentId,
		relations,
		statusOptions,
		sourceUnitType,
		sourceUnitLocatedInCountryDocumentId,
		includeDraftSourceUnits = false,
		messages,
		actions,
		createSourceUnit,
		editSourceUnit,
	} = props;

	const t = useExtracted();
	const format = useFormatter();

	const hasStatusChoice = statusOptions.length > 1;
	const singleStatus = statusOptions.length === 1 ? statusOptions[0]! : null;

	const [localRelations, setLocalRelations] = useState(relations);
	const [itemToEnd, setItemToEnd] = useState<{ id: string } | null>(null);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [selectedEndDate, setSelectedEndDate] = useState<CalendarDate | null>(null);

	const [itemToEdit, setItemToEdit] = useState<ReverseUnitRelation | null>(null);
	const [editStatusId, setEditStatusId] = useState<string | null>(null);
	const [editUnitItem, setEditUnitItem] = useState<AsyncOption | null>(null);
	const [editStartDate, setEditStartDate] = useState<CalendarDate | null>(null);
	const [editEndDate, setEditEndDate] = useState<CalendarDate | null>(null);
	const [editDescription, setEditDescription] = useState("");

	const [selectedStatusId, setSelectedStatusId] = useState<string | null>(
		singleStatus?.statusId ?? null,
	);
	const [selectedUnitItem, setSelectedUnitItem] = useState<AsyncOption | null>(null);

	const table = useClientTable({
		items: localRelations,
		sortAccessors: {
			from: (relation) => relation.duration.start,
			type: (relation) => relation.statusType,
			unit: (relation) => relation.unitName,
			until: (relation) => relation.duration.end,
		},
	});

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [editState, setEditState] = useState<ActionState>(() => createActionStateInitial());
	const [isPending, startFormTransition] = useTransition();
	const [isEditPending, startEditTransition] = useTransition();

	function resolveStatus(statusId: string | null): UnitRelationStatusOption | null {
		return statusOptions.find((entry) => entry.statusId === statusId) ?? null;
	}

	function formAction(formData: FormData) {
		const sourceUnit = selectedUnitItem;
		const option = resolveStatus(selectedStatusId);

		startFormTransition(async () => {
			const newState = await actions.create(state, formData);
			setState(newState);

			if (newState.status === "success" && option != null && sourceUnit != null) {
				const data = newState.data as
					| {
							id: string;
							durationStart: string;
							durationEnd: string | null;
							description: ReverseUnitRelation["description"];
					  }
					| undefined;

				if (data != null) {
					setLocalRelations((prev) => [
						...prev,
						{
							id: data.id,
							statusId: option.statusId,
							statusType: option.statusType,
							unitDocumentId: sourceUnit.id,
							unitName: sourceUnit.name,
							unitSlug: "",
							unitType: sourceUnitType,
							unitIsLocaleFallback: false,
							duration: {
								start: new Date(data.durationStart),
								...(data.durationEnd != null ? { end: new Date(data.durationEnd) } : {}),
							},
							description: data.description,
						},
					]);
				}

				setSelectedUnitItem(null);
				setSelectedStatusId(singleStatus?.statusId ?? null);
			}
		});
	}

	function openEditDialog(relation: ReverseUnitRelation) {
		setEditState(createActionStateInitial());
		setItemToEdit(relation);
		setEditStatusId(relation.statusId);
		setEditUnitItem({ id: relation.unitDocumentId, name: relation.unitName });
		setEditStartDate(dateToCalendarDate(relation.duration.start));
		setEditEndDate(dateToCalendarDate(relation.duration.end));
		setEditDescription(relation.description ?? "");
	}

	function editFormAction(formData: FormData) {
		const sourceUnit = editUnitItem;
		const option = resolveStatus(editStatusId);

		startEditTransition(async () => {
			const newState = await actions.update(editState, formData);
			setEditState(newState);

			if (
				newState.status === "success" &&
				itemToEdit != null &&
				option != null &&
				sourceUnit != null
			) {
				const start = editStartDate?.toDate("UTC") ?? itemToEdit.duration.start;
				const end = editEndDate?.toDate("UTC") ?? undefined;

				setLocalRelations((prev) =>
					prev.map((relation) =>
						relation.id === itemToEdit.id
							? {
									...relation,
									statusId: option.statusId,
									statusType: option.statusType,
									unitDocumentId: sourceUnit.id,
									unitName: sourceUnit.name,
									duration: { start, ...(end != null ? { end } : {}) },
									description: editDescription.trim() !== "" ? editDescription.trim() : null,
								}
							: relation,
					),
				);
				setItemToEdit(null);
			}
		});
	}

	const [isCreateUnitOpen, setIsCreateUnitOpen] = useState(false);
	const [createUnitState, setCreateUnitState] = useState<ActionState>(() =>
		createActionStateInitial(),
	);
	const [isCreateUnitPending, startCreateUnitTransition] = useTransition();

	const [unitToEdit, setUnitToEdit] = useState<{ id: string } | null>(null);
	const [editUnitFields, setEditUnitFields] = useState<EditableUnitFields | null>(null);
	const [isEditUnitFieldsLoading, setIsEditUnitFieldsLoading] = useState(false);
	const [editUnitState, setEditUnitState] = useState<ActionState>(() => createActionStateInitial());
	const [isEditUnitPending, startEditUnitTransition] = useTransition();

	function createUnitFormAction(formData: FormData) {
		if (createSourceUnit == null) {
			return;
		}

		startCreateUnitTransition(async () => {
			const newState = await createSourceUnit.action(createUnitState, formData);
			setCreateUnitState(newState);

			if (newState.status === "success") {
				const data = newState.data as { id: string; name: string } | undefined;
				if (data != null) {
					setSelectedUnitItem({ id: data.id, name: data.name });
					setIsCreateUnitOpen(false);
					setCreateUnitState(createActionStateInitial());
				}
			}
		});
	}

	function openEditUnitDialog(relation: ReverseUnitRelation) {
		if (editSourceUnit == null) {
			return;
		}

		setEditUnitState(createActionStateInitial());
		setUnitToEdit({ id: relation.unitDocumentId });
		setEditUnitFields(null);
		setIsEditUnitFieldsLoading(true);

		startTransition(async () => {
			const fields = await editSourceUnit.getFields(relation.unitDocumentId);
			setEditUnitFields(
				fields ?? { name: relation.unitName, acronym: null, ror: null, summary: null },
			);
			setIsEditUnitFieldsLoading(false);
		});
	}

	function editUnitFormAction(formData: FormData) {
		if (editSourceUnit == null) {
			return;
		}

		startEditUnitTransition(async () => {
			const newState = await editSourceUnit.updateAction(editUnitState, formData);
			setEditUnitState(newState);

			if (newState.status === "success" && unitToEdit != null) {
				const data = newState.data as { name: string } | undefined;
				if (data != null) {
					setLocalRelations((prev) =>
						prev.map((relation) =>
							relation.unitDocumentId === unitToEdit.id
								? { ...relation, unitName: data.name }
								: relation,
						),
					);
				}
				setUnitToEdit(null);
			}
		});
	}

	return (
		<Fragment>
			<div className="space-y-6 max-inline-3xl">
				<div className="space-y-1">
					<FormSectionTitle title={messages.title} />
				</div>

				{localRelations.length > 0 ? (
					<Table
						aria-label={messages.title}
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn
								allowsSorting={true}
								className="max-inline-80"
								id="unit"
								isRowHeader={true}
							>
								{messages.memberLabel}
							</TableColumn>
							{hasStatusChoice ? (
								<TableColumn allowsSorting={true} id="type">
									{t("Type")}
								</TableColumn>
							) : null}
							<TableColumn allowsSorting={true} id="from">
								{t("From")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="until">
								{t("Until")}
							</TableColumn>
							<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
						</TableHeader>
						<TableBody items={table.pageItems}>
							{(relation) => (
								<TableRow id={relation.id}>
									<TableCell>
										<div className="truncate max-inline-80" title={relation.unitName}>
											{relation.unitName}
										</div>
									</TableCell>
									{hasStatusChoice ? (
										<TableCell>
											<Badge intent="slate">{formatStatus(relation.statusType)}</Badge>
										</TableCell>
									) : null}
									<TableCell>
										{format.dateTime(relation.duration.start, { dateStyle: "short" })}
									</TableCell>
									<TableCell>
										{relation.duration.end != null
											? format.dateTime(relation.duration.end, { dateStyle: "short" })
											: t("present")}
									</TableCell>
									<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
										<RowActionsMenu>
											<RowActionsMenu.Action
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													openEditDialog(relation);
												}}
											>
												{t("Edit relation")}
											</RowActionsMenu.Action>
											{editSourceUnit != null && (
												<RowActionsMenu.Action
													icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
													onAction={() => {
														openEditUnitDialog(relation);
													}}
												>
													{editSourceUnit.rowActionLabel}
												</RowActionsMenu.Action>
											)}
											{relation.duration.end == null && (
												<RowActionsMenu.Action
													icon={<ArchiveBoxXMarkIcon className="me-2 block-4 inline-4" />}
													onAction={() => {
														setItemToEnd({ id: relation.id });
														setSelectedEndDate(null);
													}}
												>
													{t("End relation")}
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
												{t("Delete relation")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{messages.empty}</p>
				)}

				{table.totalPages > 1 && (
					<Paginate
						page={table.page}
						setPage={table.setPage}
						total={table.totalPages}
						totalItems={table.total}
					/>
				)}

				{statusOptions.length > 0 && (
					<FormLayout variant="stacked">
						<Form action={formAction} className="flex flex-col gap-y-6" state={state}>
							<FormSection
								description={t("Add a new relation to another organisational unit.")}
								title={messages.addButton}
								variant="stacked"
							>
								{hasStatusChoice ? (
									<Select
										isRequired={true}
										onChange={(key) => {
											setSelectedStatusId(String(key));
										}}
										value={selectedStatusId}
									>
										<Label>{t("Relation type")}</Label>
										<SelectTrigger />
										<FieldError />
										<SelectContent>
											{statusOptions.map((option) => (
												<SelectItem key={option.statusId} id={option.statusId}>
													{formatStatus(option.statusType)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : null}
								<input name="statusId" type="hidden" value={selectedStatusId ?? ""} />

								<AsyncSelect
									aria-label={messages.memberLabel}
									emptyMessage={t("No related units found.")}
									fetchPage={(params) =>
										fetchSourceUnitOptionsPage(
											sourceUnitType,
											params,
											sourceUnitLocatedInCountryDocumentId,
											includeDraftSourceUnits,
										)
									}
									initialItems={[]}
									initialTotal={0}
									isRequired={true}
									label={messages.memberLabel}
									loadOnMount={true}
									onSelect={(item) => {
										setSelectedUnitItem(item);
									}}
									placeholder={t("No related unit selected")}
									selectedItem={selectedUnitItem}
								/>
								<input name="unitDocumentId" type="hidden" value={selectedUnitItem?.id ?? ""} />

								{createSourceUnit != null ? (
									<Button
										className="self-start"
										intent="outline"
										onPress={() => {
											setCreateUnitState(createActionStateInitial());
											setIsCreateUnitOpen(true);
										}}
									>
										{createSourceUnit.buttonLabel}
									</Button>
								) : null}

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

								<TextField name="description">
									<Label>{t("Description")}</Label>
									<Input />
									<FieldError />
								</TextField>

								<input name="relatedUnitDocumentId" type="hidden" value={relatedUnitDocumentId} />
							</FormSection>

							<Button className="self-start" isPending={isPending} type="submit">
								{isPending ? (
									<Fragment>
										<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
										<span aria-hidden={true}>{t("Saving...")}</span>
									</Fragment>
								) : (
									messages.addButton
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
					description={t("Set the date on which this relation ended.")}
					title={t("End relation")}
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
								await actions.end(itemToEnd.id, end);
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
					description={t("Update the related unit, relation type, and duration.")}
					title={t("Edit relation")}
				/>
				<Form action={editFormAction} state={editState}>
					<ModalBody className="flex flex-col gap-y-4">
						<input name="id" type="hidden" value={itemToEdit?.id ?? ""} />
						<input name="relatedUnitDocumentId" type="hidden" value={relatedUnitDocumentId} />
						{hasStatusChoice ? (
							<Select
								isRequired={true}
								onChange={(key) => {
									setEditStatusId(String(key));
								}}
								value={editStatusId}
							>
								<Label>{t("Relation type")}</Label>
								<SelectTrigger />
								<FieldError />
								<SelectContent>
									{statusOptions.map((option) => (
										<SelectItem key={option.statusId} id={option.statusId}>
											{formatStatus(option.statusType)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
						<input name="statusId" type="hidden" value={editStatusId ?? ""} />
						<AsyncSelect
							aria-label={messages.memberLabel}
							emptyMessage={t("No related units found.")}
							fetchPage={(params) =>
								fetchSourceUnitOptionsPage(
									sourceUnitType,
									params,
									sourceUnitLocatedInCountryDocumentId,
									includeDraftSourceUnits,
								)
							}
							initialItems={[]}
							initialTotal={0}
							isRequired={true}
							label={messages.memberLabel}
							loadOnMount={true}
							onSelect={(item) => {
								setEditUnitItem(item);
							}}
							placeholder={t("No related unit selected")}
							selectedItem={editUnitItem}
						/>
						<input name="unitDocumentId" type="hidden" value={editUnitItem?.id ?? ""} />
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
						<TextField name="description" onChange={setEditDescription} value={editDescription}>
							<Label>{t("Description")}</Label>
							<Input />
							<FieldError />
						</TextField>
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
					description={t("This will permanently delete this relation.")}
					title={t("Delete relation")}
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
								await actions.delete(id);
								setLocalRelations((prev) => prev.filter((relation) => relation.id !== id));
								setItemToDelete(null);
							});
						}}
					>
						{t("Delete")}
					</Button>
				</ModalFooter>
			</ModalContent>

			{createSourceUnit != null ? (
				<ModalContent
					isOpen={isCreateUnitOpen}
					onOpenChange={(open) => {
						if (!open) {
							setIsCreateUnitOpen(false);
						}
					}}
				>
					<ModalHeader
						description={t("Create a new entry, then select it above.")}
						title={createSourceUnit.title}
					/>
					<Form action={createUnitFormAction} state={createUnitState}>
						<ModalBody className="flex flex-col gap-y-4">
							<input
								name="scopeDocumentId"
								type="hidden"
								value={createSourceUnit.scopeDocumentId}
							/>
							<TextField isRequired={true} name="name">
								<Label>{t("Name")}</Label>
								<Input />
								<FieldError />
							</TextField>
							<TextField name="acronym">
								<Label>{t("Acronym")}</Label>
								<Input />
								<FieldError />
							</TextField>
							<TextField name="ror">
								<Label>{t("ROR")}</Label>
								<Input />
								<FieldError />
							</TextField>
							<TextField name="summary">
								<Label>{t("Summary")}</Label>
								<Input />
								<FieldError />
							</TextField>
							<FormStatus className="self-start" state={createUnitState} />
						</ModalBody>
						<ModalFooter>
							<ModalClose>{t("Cancel")}</ModalClose>
							<Button isPending={isCreateUnitPending} type="submit">
								{isCreateUnitPending ? (
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
			) : null}

			{editSourceUnit != null ? (
				<ModalContent
					isOpen={unitToEdit != null}
					onOpenChange={(open) => {
						if (!open) {
							setUnitToEdit(null);
						}
					}}
				>
					<ModalHeader
						description={t("Edit the details of the selected entry.")}
						title={editSourceUnit.title}
					/>
					{isEditUnitFieldsLoading || editUnitFields == null ? (
						<ModalBody>
							<ProgressCircle aria-label={t("Loading...")} isIndeterminate={true} />
						</ModalBody>
					) : (
						<Form action={editUnitFormAction} state={editUnitState}>
							<ModalBody className="flex flex-col gap-y-4">
								<input name="documentId" type="hidden" value={unitToEdit?.id ?? ""} />
								<TextField defaultValue={editUnitFields.name} isRequired={true} name="name">
									<Label>{t("Name")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField defaultValue={editUnitFields.acronym ?? undefined} name="acronym">
									<Label>{t("Acronym")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField defaultValue={editUnitFields.ror ?? undefined} name="ror">
									<Label>{t("ROR")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<TextField defaultValue={editUnitFields.summary ?? undefined} name="summary">
									<Label>{t("Summary")}</Label>
									<Input />
									<FieldError />
								</TextField>
								<FormStatus className="self-start" state={editUnitState} />
							</ModalBody>
							<ModalFooter>
								<ModalClose>{t("Cancel")}</ModalClose>
								<Button isPending={isEditUnitPending} type="submit">
									{isEditUnitPending ? (
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
					)}
				</ModalContent>
			) : null}
		</Fragment>
	);
}
