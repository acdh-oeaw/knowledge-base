"use client";

import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { AsyncSelect } from "@acdh-knowledge-base/ui/async-select";
import { Badge } from "@acdh-knowledge-base/ui/badge";
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
import type { AsyncOption, AsyncOptionsFetchPageParams } from "@acdh-knowledge-base/ui/use-async-options";
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
import { createUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.action";
import { deleteUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/delete-unit-relation.action";
import { endUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/end-unit-relation.action";
import { updateUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-unit-relation.action";
import type { OrganisationalUnitType } from "@/lib/data/organisational-units";
import type { ReverseUnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";
import { dateToCalendarDate } from "@/lib/date";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

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
	/** Entity-specific copy, kept in the parent so message extraction works. */
	messages: {
		title: string;
		/** Singular noun for the source unit, used as column header and picker label. */
		memberLabel: string;
		empty: string;
		addButton: string;
	};
}

async function fetchSourceUnitOptionsPage(
	unitType: string,
	params: Readonly<AsyncOptionsFetchPageParams>,
	locatedInCountryDocumentId?: string,
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
		messages,
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
			const newState = await createUnitRelationAction(state, formData);
			setState(newState);

			if (newState.status === "success" && option != null && sourceUnit != null) {
				const data = newState.data as
					| { id: string; durationStart: string; durationEnd: string | null }
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
							duration: {
								start: new Date(data.durationStart),
								...(data.durationEnd != null ? { end: new Date(data.durationEnd) } : {}),
							},
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
	}

	function editFormAction(formData: FormData) {
		const sourceUnit = editUnitItem;
		const option = resolveStatus(editStatusId);

		startEditTransition(async () => {
			const newState = await updateUnitRelationAction(editState, formData);
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
							<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end" />
						</TableHeader>
						<TableBody items={table.pageItems}>
							{(relation) => (
								<TableRow id={relation.id}>
									<TableCell>
										<div className="max-inline-80 truncate" title={relation.unitName}>
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
									<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
										<RowActionsMenu>
											<RowActionsMenu.Action
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													openEditDialog(relation);
												}}
											>
												{t("Edit relation")}
											</RowActionsMenu.Action>
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
								await endUnitRelationAction(itemToEnd.id, end);
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
								await deleteUnitRelationAction(id);
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
