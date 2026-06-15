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
import type { UnitRelation, UnitRelationStatusOption } from "@/lib/data/unit-relations";
import { dateToCalendarDate } from "@/lib/date";

interface UnitRelationsSectionProps {
	unitDocumentId: string;
	relations: Array<UnitRelation & { lifecycleStatus?: "changed" | "new" }>;
	statusOptions: Array<UnitRelationStatusOption>;
}

async function fetchRelatedUnitOptionsPage(
	unitDocumentId: string,
	statusId: string,
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		statusId,
		unitDocumentId,
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/unit-relations/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load related units.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

function formatStatus(type: string): string {
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

export function UnitRelationsSection(props: Readonly<UnitRelationsSectionProps>): ReactNode {
	const { unitDocumentId, relations, statusOptions } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [localRelations, setLocalRelations] = useState(relations);
	const [itemToEnd, setItemToEnd] = useState<{ id: string } | null>(null);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [selectedEndDate, setSelectedEndDate] = useState<CalendarDate | null>(null);
	const [itemToEdit, setItemToEdit] = useState<UnitRelation | null>(null);
	const [editStatusId, setEditStatusId] = useState<string | null>(null);
	const [editUnitItem, setEditUnitItem] = useState<AsyncOption | null>(null);
	const [editStartDate, setEditStartDate] = useState<CalendarDate | null>(null);
	const [editEndDate, setEditEndDate] = useState<CalendarDate | null>(null);

	const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
	const [selectedUnitItem, setSelectedUnitItem] = useState<AsyncOption | null>(null);

	const table = useClientTable({
		items: localRelations,
		sortAccessors: {
			from: (relation) => relation.duration.start,
			relatedUnit: (relation) => relation.relatedUnitName,
			status: (relation) => relation.statusType,
			type: (relation) => relation.relatedUnitType,
			until: (relation) => relation.duration.end,
		},
	});

	const [state, setState] = useState<ActionState>(() => createActionStateInitial());
	const [editState, setEditState] = useState<ActionState>(() => createActionStateInitial());
	const [isPending, startFormTransition] = useTransition();
	const [isEditPending, startEditTransition] = useTransition();

	function formAction(formData: FormData) {
		const statusId = selectedStatusId;
		const relatedUnit = selectedUnitItem;
		const option = statusOptions.find((entry) => entry.statusId === statusId);

		startFormTransition(async () => {
			const newState = await createUnitRelationAction(state, formData);
			setState(newState);

			if (newState.status === "success" && option != null && relatedUnit != null) {
				const data = newState.data as
					| {
							id: string;
							durationStart: string;
							durationEnd: string | null;
							relatedUnitType: UnitRelation["relatedUnitType"];
							relatedUnitSlug: UnitRelation["relatedUnitSlug"];
					  }
					| undefined;

				if (data != null) {
					setLocalRelations((prev) => [
						...prev,
						{
							id: data.id,
							statusId: option.statusId,
							statusType: option.statusType,
							relatedUnitDocumentId: relatedUnit.id,
							relatedUnitName: relatedUnit.name,
							relatedUnitSlug: data.relatedUnitSlug,
							relatedUnitType: data.relatedUnitType,
							duration: {
								start: new Date(data.durationStart),
								...(data.durationEnd != null ? { end: new Date(data.durationEnd) } : {}),
							},
						},
					]);
				}

				setSelectedStatusId(null);
				setSelectedUnitItem(null);
			}
		});
	}

	function openEditDialog(relation: UnitRelation) {
		setEditState(createActionStateInitial());
		setItemToEdit(relation);
		setEditStatusId(relation.statusId);
		setEditUnitItem({
			id: relation.relatedUnitDocumentId,
			name: relation.relatedUnitName,
			description: formatUnitType(relation.relatedUnitType),
		});
		setEditStartDate(dateToCalendarDate(relation.duration.start));
		setEditEndDate(dateToCalendarDate(relation.duration.end));
	}

	function editFormAction(formData: FormData) {
		const statusId = editStatusId;
		const relatedUnit = editUnitItem;
		const option = statusOptions.find((entry) => entry.statusId === statusId);

		startEditTransition(async () => {
			const newState = await updateUnitRelationAction(editState, formData);
			setEditState(newState);

			if (
				newState.status === "success" &&
				itemToEdit != null &&
				option != null &&
				relatedUnit != null
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
									relatedUnitDocumentId: relatedUnit.id,
									relatedUnitName: relatedUnit.name,
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
					<FormSectionTitle title={t("Relations")} />
				</div>

				{localRelations.length > 0 ? (
					<Table
						aria-label="relations"
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn allowsSorting={true} id="status" isRowHeader={true}>
								{t("Status")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="type">
								{t("Type")}
							</TableColumn>
							<TableColumn allowsSorting={true} className="max-inline-80" id="relatedUnit">
								{t("Related unit")}
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
										<div className="flex items-center gap-x-2">
											<span>{formatStatus(relation.statusType)}</span>
											{relation.lifecycleStatus != null && (
												<Badge intent={relation.lifecycleStatus === "new" ? "emerald" : "amber"}>
													{formatLifecycleStatus(relation.lifecycleStatus, t)}
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge intent="slate">{formatUnitType(relation.relatedUnitType)}</Badge>
									</TableCell>
									<TableCell>
										<div className="max-inline-80 truncate" title={relation.relatedUnitName}>
											{relation.relatedUnitName}
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
					<p className="text-sm text-neutral-500">{t("No relations.")}</p>
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
								title={t("Add relation")}
								variant="stacked"
							>
								<Select
									isRequired={true}
									onChange={(key) => {
										setSelectedStatusId(String(key));
										setSelectedUnitItem(null);
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
								<input name="statusId" type="hidden" value={selectedStatusId ?? ""} />

								<AsyncSelect
									aria-label={t("Related unit")}
									cacheKey={selectedStatusId ?? "none"}
									emptyMessage={t("No related units found.")}
									fetchPage={(params) => {
										if (selectedStatusId == null) {
											return Promise.resolve({ items: [], total: 0 });
										}

										return fetchRelatedUnitOptionsPage(unitDocumentId, selectedStatusId, params);
									}}
									initialItems={[]}
									initialTotal={0}
									isDisabled={selectedStatusId == null}
									isRequired={true}
									label={t("Related unit")}
									loadOnMount={selectedStatusId != null}
									onSelect={(item) => {
										setSelectedUnitItem(item);
									}}
									placeholder={t("No related unit selected")}
									selectedItem={selectedUnitItem}
								/>
								<input
									name="relatedUnitDocumentId"
									type="hidden"
									value={selectedUnitItem?.id ?? ""}
								/>

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

								<input name="unitDocumentId" type="hidden" value={unitDocumentId} />
							</FormSection>

							<Button className="self-start" isPending={isPending} type="submit">
								{isPending ? (
									<Fragment>
										<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
										<span aria-hidden={true}>{t("Saving...")}</span>
									</Fragment>
								) : (
									t("Add relation")
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
						<input name="unitDocumentId" type="hidden" value={unitDocumentId} />
						<Select
							isRequired={true}
							onChange={(key) => {
								setEditStatusId(String(key));
								setEditUnitItem(null);
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
						<input name="statusId" type="hidden" value={editStatusId ?? ""} />
						<AsyncSelect
							aria-label={t("Related unit")}
							cacheKey={editStatusId ?? "none"}
							emptyMessage={t("No related units found.")}
							fetchPage={(params) => {
								if (editStatusId == null) {
									return Promise.resolve({ items: [], total: 0 });
								}

								return fetchRelatedUnitOptionsPage(unitDocumentId, editStatusId, params);
							}}
							initialItems={[]}
							initialTotal={0}
							isDisabled={editStatusId == null}
							isRequired={true}
							label={t("Related unit")}
							loadOnMount={editStatusId != null}
							onSelect={(item) => {
								setEditUnitItem(item);
							}}
							placeholder={t("No related unit selected")}
							selectedItem={editUnitItem}
						/>
						<input name="relatedUnitDocumentId" type="hidden" value={editUnitItem?.id ?? ""} />
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
