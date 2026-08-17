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
import { createUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-unit-relation.action";
import { deleteUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/delete-unit-relation.action";
import { updateUnitRelationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-unit-relation.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { InstitutionRelationsResult } from "@/lib/data/institution-relations";
import type { UnitRelationStatusOption } from "@/lib/data/unit-relations";
import { dateToCalendarDate } from "@/lib/date";
import { useRouter } from "@/lib/navigation/navigation";
import {
	type OrganisationalUnitOption,
	toOrganisationalUnitDocumentOptionsPage,
} from "@/lib/organisational-unit-options";

interface InstitutionRelationsPageProps {
	institutionRelations: InstitutionRelationsResult;
	statusOptions: Array<UnitRelationStatusOption>;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort:
		| "institutionName"
		| "statusType"
		| "relatedUnitName"
		| "relatedUnitType"
		| "durationStart"
		| "durationEnd";
}

type InstitutionRelationItem = InstitutionRelationsResult["data"][number];

interface InstitutionRelationDialogState {
	isOpen: boolean;
	item: InstitutionRelationItem | null;
	institution: AsyncOption | null;
	statusId: string | null;
	relatedUnit: AsyncOption | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: InstitutionRelationDialogState = {
	isOpen: false,
	item: null,
	institution: null,
	statusId: null,
	relatedUnit: null,
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

async function fetchInstitutionOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	const searchParams = new URLSearchParams({
		limit: String(params.limit),
		offset: String(params.offset),
		unitType: "institution",
	});

	if (params.q !== "") {
		searchParams.set("q", params.q);
	}

	const response = await fetch(`/api/organisational-units/options?${searchParams.toString()}`, {
		signal: params.signal,
	});

	if (!response.ok) {
		throw new Error("Failed to load institutions.");
	}

	return toOrganisationalUnitDocumentOptionsPage(
		(await response.json()) as { items: Array<OrganisationalUnitOption>; total: number },
	);
}

async function fetchRelatedUnitOptionsPage(
	unitDocumentId: string | null,
	statusId: string | null,
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	if (unitDocumentId == null || statusId == null) {
		return { items: [], total: 0 };
	}

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

export function InstitutionRelationsPage(
	props: Readonly<InstitutionRelationsPageProps>,
): ReactNode {
	const {
		institutionRelations,
		statusOptions,
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(
		institutionRelations.data,
		(state, id: string) => state.filter((item) => item.id !== id),
	);
	const [dialog, setDialog] = useState<InstitutionRelationDialogState>(emptyDialog);
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

	function openEditDialog(item: InstitutionRelationItem) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			institution: { id: item.institutionDocumentId, name: item.institutionName },
			statusId: item.statusId,
			relatedUnit: {
				id: item.relatedUnitDocumentId,
				name: item.relatedUnitName,
				description: formatValue(item.relatedUnitType),
			},
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		startFormTransition(async () => {
			const newState =
				dialog.item == null
					? await createUnitRelationAction(formState, formData)
					: await updateUnitRelationAction(formState, formData);

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
				title={t("Institution relations")}
				description={t("Review and manage dated institution-to-organisation relations.")}
				action={
					<>
						<EntityListSearchField search={search} />
						<Button
							className="shrink-0 whitespace-pre"
							intent="secondary"
							onPress={openCreateDialog}
						>
							<PlusIcon className="me-2 block-4 inline-4" />
							{t("Add relation")}
						</Button>
					</>
				}
			/>

			<Table
				aria-label="institution relations"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn
						allowsSorting={true}
						className="max-inline-80"
						id="institutionName"
						isRowHeader={true}
					>
						{t("Institution")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="statusType">
						{t("Relation")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="relatedUnitType">
						{t("Type")}
					</TableColumn>
					<TableColumn allowsSorting={true} className="max-inline-80" id="relatedUnitName">
						{t("Name")}
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
								<div className="max-inline-80 truncate" title={item.institutionName}>
									{item.institutionName}
								</div>
							</TableCell>
							<TableCell>{formatValue(item.statusType)}</TableCell>
							<TableCell>
								<Badge intent={organisationalUnitTypeIntent(item.relatedUnitType)}>
									{formatValue(item.relatedUnitType)}
								</Badge>
							</TableCell>
							<TableCell>
								<div className="max-inline-80 truncate" title={item.relatedUnitName}>
									{item.relatedUnitName}
								</div>
							</TableCell>
							<TableCell>{format.dateTime(item.durationStart, { dateStyle: "short" })}</TableCell>
							<TableCell>
								{item.durationEnd != null
									? format.dateTime(item.durationEnd, { dateStyle: "short" })
									: t("present")}
							</TableCell>
							<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-60% from-bg text-end">
								<RowActionsMenu>
									<RowActionsMenu.Action
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
										onAction={() => {
											openEditDialog(item);
										}}
									>
										{t("Edit relation")}
									</RowActionsMenu.Action>
									<RowActionsMenu.Link
										href={`/dashboard/administrator/institutions/${item.institutionSlug}/edit`}
										icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
									>
										{t("Edit institution")}
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

			<EntityListPagination
				search={search}
				total={institutionRelations.total}
				pageSize={pageSize}
			/>

			<ModalContent
				isOpen={dialog.isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setDialog(emptyDialog);
					}
				}}
			>
				<ModalHeader
					title={dialog.item == null ? t("Add relation") : t("Edit relation")}
					description={t(
						"Select the institution, related organisation, relation type, and duration.",
					)}
				/>
				<Form action={formAction} state={formState}>
					<ModalBody className="flex flex-col gap-y-4">
						{dialog.item != null ? <input name="id" type="hidden" value={dialog.item.id} /> : null}
						<AsyncSelect
							aria-label={t("Institution")}
							emptyMessage={t("No institutions found.")}
							fetchPage={fetchInstitutionOptionsPage}
							initialItems={[]}
							initialTotal={0}
							isRequired={true}
							label={t("Institution")}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, institution: item, relatedUnit: null };
								});
							}}
							placeholder={t("No institution selected")}
							selectedItem={dialog.institution}
						/>
						<input name="unitDocumentId" type="hidden" value={dialog.institution?.id ?? ""} />
						<Select
							isRequired={true}
							onChange={(key) => {
								setDialog((prev) => {
									return { ...prev, statusId: String(key), relatedUnit: null };
								});
							}}
							value={dialog.statusId}
						>
							<Label>{t("Relation type")}</Label>
							<SelectTrigger />
							<FieldError />
							<SelectContent>
								{statusOptions.map((option) => (
									<SelectItem key={option.statusId} id={option.statusId}>
										{formatValue(option.statusType)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<input name="statusId" type="hidden" value={dialog.statusId ?? ""} />
						<AsyncSelect
							aria-label={t("Related unit")}
							cacheKey={`${dialog.institution?.id ?? "none"}:${dialog.statusId ?? "none"}`}
							emptyMessage={t("No related units found.")}
							fetchPage={(params) =>
								fetchRelatedUnitOptionsPage(dialog.institution?.id ?? null, dialog.statusId, params)
							}
							initialItems={[]}
							initialTotal={0}
							isDisabled={dialog.institution == null || dialog.statusId == null}
							isRequired={true}
							label={t("Related unit")}
							loadOnMount={dialog.institution != null && dialog.statusId != null}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, relatedUnit: item };
								});
							}}
							placeholder={t("No related unit selected")}
							selectedItem={dialog.relatedUnit}
						/>
						<input
							name="relatedUnitDocumentId"
							type="hidden"
							value={dialog.relatedUnit?.id ?? ""}
						/>
						<DatePicker
							granularity="day"
							isRequired={true}
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
				model={t("institution relation")}
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
							await deleteUnitRelationAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete institution relation. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
