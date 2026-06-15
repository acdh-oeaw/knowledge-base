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
import { createContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-contribution.action";
import { endContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/end-contribution.action";
import { updateContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-contribution.action";
import { deleteContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/contributions/_lib/delete-contribution.action";
import type { ContributionRoleOption, PersonContribution } from "@/lib/data/contributions";
import { dateToCalendarDate } from "@/lib/date";

interface ContributionsSectionProps {
	personDocumentId: string;
	contributions: Array<PersonContribution & { lifecycleStatus?: "changed" | "new" }>;
	roleOptions: Array<ContributionRoleOption>;
}

interface CreateContributionActionData {
	id: string;
	durationStart: string;
	durationEnd: string | null;
	targetUnitType: PersonContribution["organisationalUnitType"];
	organisationalUnitSlug: PersonContribution["organisationalUnitSlug"];
}

async function fetchOrganisationalUnitOptionsPage(
	roleTypeId: string,
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		resource: "organisational-units",
		roleTypeId,
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/contributions/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load organisations.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

function formatRoleType(type: string): string {
	return type.replaceAll("_", " ");
}

function formatLifecycleStatus(
	status: "changed" | "new",
	t: ReturnType<typeof useExtracted>,
): string {
	return status === "new" ? t("New") : t("Changed");
}

function formatRoleOptionLabel(option: ContributionRoleOption): string {
	const allowedTypes = option.allowedUnitTypes.map(formatRoleType).join(", ");

	return `${formatRoleType(option.roleType)} - ${allowedTypes}`;
}

export function ContributionsSection(props: Readonly<ContributionsSectionProps>): ReactNode {
	const { personDocumentId, roleOptions, contributions } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [localContributions, setLocalContributions] = useState(contributions);
	const [itemToEnd, setItemToEnd] = useState<{ id: string } | null>(null);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [selectedEndDate, setSelectedEndDate] = useState<CalendarDate | null>(null);

	const [selectedRoleTypeId, setSelectedRoleTypeId] = useState<string | null>(null);
	const [selectedUnit, setSelectedUnit] = useState<AsyncOption | null>(null);

	const [itemToEdit, setItemToEdit] = useState<PersonContribution | null>(null);
	const [editRoleTypeId, setEditRoleTypeId] = useState<string | null>(null);
	const [editUnit, setEditUnit] = useState<AsyncOption | null>(null);
	const [editStartDate, setEditStartDate] = useState<CalendarDate | null>(null);
	const [editEndDate, setEditEndDate] = useState<CalendarDate | null>(null);

	const table = useClientTable({
		items: localContributions,
		sortAccessors: {
			from: (contribution) => contribution.duration.start,
			organisation: (contribution) => contribution.organisationalUnitName,
			role: (contribution) => contribution.roleType,
			type: (contribution) => contribution.organisationalUnitType,
			until: (contribution) => contribution.duration.end,
		},
	});

	const [state, setState] = useState<ActionState>(createActionStateInitial());
	const [editState, setEditState] = useState<ActionState>(() => createActionStateInitial());
	const [isPending, startFormTransition] = useTransition();
	const [isEditPending, startEditTransition] = useTransition();

	const validationErrors = state.status === "error" ? state.validationErrors : undefined;
	const selectedRoleOption = roleOptions.find((option) => option.roleTypeId === selectedRoleTypeId);
	const editValidationErrors =
		editState.status === "error" ? editState.validationErrors : undefined;
	const editRoleOption = roleOptions.find((option) => option.roleTypeId === editRoleTypeId);

	function formAction(formData: FormData) {
		const roleTypeId = selectedRoleTypeId;
		const unit = selectedUnit;
		const option = selectedRoleOption;

		startFormTransition(async () => {
			const newState = await createContributionAction(state, formData);
			setState(newState);

			if (newState.status === "success" && option != null && unit != null) {
				const data = newState.data as CreateContributionActionData;

				setLocalContributions((prev) => [
					...prev,
					{
						id: data.id,
						roleTypeId: roleTypeId!,
						roleType: option.roleType as PersonContribution["roleType"],
						organisationalUnitDocumentId: unit.id,
						organisationalUnitName: unit.name,
						organisationalUnitSlug: data.organisationalUnitSlug,
						organisationalUnitType: data.targetUnitType,
						duration: {
							start: new Date(data.durationStart),
							...(data.durationEnd != null ? { end: new Date(data.durationEnd) } : {}),
						},
					},
				]);

				setSelectedRoleTypeId(null);
				setSelectedUnit(null);
			}
		});
	}

	function openEditDialog(contribution: PersonContribution) {
		setEditState(createActionStateInitial());
		setItemToEdit(contribution);
		setEditRoleTypeId(contribution.roleTypeId);
		setEditUnit({
			id: contribution.organisationalUnitDocumentId,
			name: contribution.organisationalUnitName,
			description: formatRoleType(contribution.organisationalUnitType),
		});
		setEditStartDate(dateToCalendarDate(contribution.duration.start));
		setEditEndDate(dateToCalendarDate(contribution.duration.end));
	}

	function editFormAction(formData: FormData) {
		const unit = editUnit;
		const option = editRoleOption;

		startEditTransition(async () => {
			const newState = await updateContributionAction(editState, formData);
			setEditState(newState);

			if (newState.status === "success" && itemToEdit != null && option != null && unit != null) {
				const start = editStartDate?.toDate("UTC") ?? itemToEdit.duration.start;
				const end = editEndDate?.toDate("UTC") ?? undefined;

				setLocalContributions((prev) =>
					prev.map((contribution) =>
						contribution.id === itemToEdit.id
							? {
									...contribution,
									roleTypeId: option.roleTypeId,
									roleType: option.roleType as PersonContribution["roleType"],
									organisationalUnitDocumentId: unit.id,
									organisationalUnitName: unit.name,
									duration: { start, ...(end != null ? { end } : {}) },
								}
							: contribution,
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
					<FormSectionTitle title={t("Contributions")} />
				</div>

				{localContributions.length > 0 ? (
					<Table
						aria-label="contributions"
						className="[--gutter:0] sm:[--gutter:0]"
						onSortChange={table.onSortChange}
						sortDescriptor={table.sortDescriptor}
					>
						<TableHeader>
							<TableColumn allowsSorting={true} id="role" isRowHeader={true}>
								{t("Role")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="type">
								{t("Type")}
							</TableColumn>
							<TableColumn allowsSorting={true} className="max-inline-80" id="organisation">
								{t("Organisation")}
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
							{(contribution) => (
								<TableRow id={contribution.id}>
									<TableCell>
										<div className="flex items-center gap-x-2">
											<span>{formatRoleType(contribution.roleType)}</span>
											{contribution.lifecycleStatus != null && (
												<Badge
													intent={contribution.lifecycleStatus === "new" ? "emerald" : "amber"}
												>
													{formatLifecycleStatus(contribution.lifecycleStatus, t)}
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge intent="slate">
											{formatRoleType(contribution.organisationalUnitType)}
										</Badge>
									</TableCell>
									<TableCell>
										<div
											className="max-inline-80 truncate"
											title={contribution.organisationalUnitName}
										>
											{contribution.organisationalUnitName}
										</div>
									</TableCell>
									<TableCell>
										{format.dateTime(contribution.duration.start, { dateStyle: "short" })}
									</TableCell>
									<TableCell>
										{contribution.duration.end != null
											? format.dateTime(contribution.duration.end, { dateStyle: "short" })
											: t("present")}
									</TableCell>
									<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
										<RowActionsMenu>
											<RowActionsMenu.Action
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													openEditDialog(contribution);
												}}
											>
												{t("Edit contribution")}
											</RowActionsMenu.Action>
											{contribution.duration.end == null && (
												<RowActionsMenu.Action
													icon={<ArchiveBoxXMarkIcon className="me-2 block-4 inline-4" />}
													onAction={() => {
														setItemToEnd({ id: contribution.id });
														setSelectedEndDate(null);
													}}
												>
													{t("End contribution")}
												</RowActionsMenu.Action>
											)}
											<RowActionsMenu.Separator />
											<RowActionsMenu.Action
												danger={true}
												icon={<TrashIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													setItemToDelete({ id: contribution.id });
												}}
											>
												{t("Delete contribution")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No contributions.")}</p>
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
								description={t("Add a new contribution to an organisational unit.")}
								title={t("Add contribution")}
								variant="stacked"
							>
								<Select
									isRequired={true}
									onChange={(key) => {
										setSelectedRoleTypeId(String(key));
										setSelectedUnit(null);
									}}
									value={selectedRoleTypeId}
								>
									<Label>{t("Role")}</Label>
									<SelectTrigger />
									<FieldError />
									<SelectContent>
										{roleOptions.map((option) => (
											<SelectItem key={option.roleTypeId} id={option.roleTypeId}>
												{formatRoleOptionLabel(option)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<input name="roleTypeId" type="hidden" value={selectedRoleTypeId ?? ""} />

								<AsyncSelect
									aria-label={t("Organisation")}
									cacheKey={selectedRoleTypeId ?? "none"}
									emptyMessage={
										selectedRoleOption != null
											? t("No organisations found.")
											: t("Select a role first.")
									}
									errorMessage={
										typeof validationErrors?.organisationalUnitDocumentId === "string"
											? validationErrors.organisationalUnitDocumentId
											: undefined
									}
									fetchPage={(params) => {
										if (selectedRoleTypeId == null) {
											return Promise.resolve({ items: [], total: 0 });
										}

										return fetchOrganisationalUnitOptionsPage(selectedRoleTypeId, params);
									}}
									initialItems={[]}
									initialTotal={0}
									isDisabled={selectedRoleOption == null}
									isRequired={true}
									label={t("Organisation")}
									loadOnMount={selectedRoleTypeId != null}
									onSelect={setSelectedUnit}
									placeholder={
										selectedRoleOption != null
											? t("Select an organisation")
											: t("Select a role first")
									}
									selectedItem={selectedUnit}
								/>
								<input
									name="organisationalUnitDocumentId"
									type="hidden"
									value={selectedUnit?.id ?? ""}
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

								<input name="personDocumentId" type="hidden" value={personDocumentId} />
							</FormSection>

							<Button className="self-start" isPending={isPending} type="submit">
								{isPending ? (
									<Fragment>
										<ProgressCircle aria-label={t("Saving...")} isIndeterminate={true} />
										<span aria-hidden={true}>{t("Saving...")}</span>
									</Fragment>
								) : (
									t("Add contribution")
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
					description={t("Set the date on which this contribution ended.")}
					title={t("End contribution")}
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
								setLocalContributions((prev) =>
									prev.map((c) =>
										c.id === itemToEnd.id ? { ...c, duration: { ...c.duration, end } } : c,
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
					description={t("Update the organisation, role, and duration.")}
					title={t("Edit contribution")}
				/>
				<Form action={editFormAction} state={editState}>
					<ModalBody className="flex flex-col gap-y-4">
						<input name="id" type="hidden" value={itemToEdit?.id ?? ""} />
						<input name="personDocumentId" type="hidden" value={personDocumentId} />
						<Select
							isRequired={true}
							onChange={(key) => {
								setEditRoleTypeId(String(key));
								setEditUnit(null);
							}}
							value={editRoleTypeId}
						>
							<Label>{t("Role")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{roleOptions.map((option) => (
									<SelectItem key={option.roleTypeId} id={option.roleTypeId}>
										{formatRoleOptionLabel(option)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="roleTypeId" type="hidden" value={editRoleTypeId ?? ""} />
						<AsyncSelect
							aria-label={t("Organisation")}
							cacheKey={editRoleTypeId ?? "none"}
							emptyMessage={
								editRoleOption != null ? t("No organisations found.") : t("Select a role first.")
							}
							errorMessage={
								typeof editValidationErrors?.organisationalUnitDocumentId === "string"
									? editValidationErrors.organisationalUnitDocumentId
									: undefined
							}
							fetchPage={(params) => {
								if (editRoleTypeId == null) {
									return Promise.resolve({ items: [], total: 0 });
								}

								return fetchOrganisationalUnitOptionsPage(editRoleTypeId, params);
							}}
							initialItems={[]}
							initialTotal={0}
							isDisabled={editRoleOption == null}
							isRequired={true}
							label={t("Organisation")}
							loadOnMount={editRoleTypeId != null}
							onSelect={setEditUnit}
							placeholder={
								editRoleOption != null ? t("Select an organisation") : t("Select a role first")
							}
							selectedItem={editUnit}
						/>
						<input name="organisationalUnitDocumentId" type="hidden" value={editUnit?.id ?? ""} />
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
					description={t("This will permanently delete this contribution.")}
					title={t("Delete contribution")}
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
								setLocalContributions((prev) =>
									prev.filter((contribution) => contribution.id !== id),
								);
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
