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
import { createContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/create-contribution.action";
import { updateContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/_lib/update-contribution.action";
import { deleteContributionAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/contributions/_lib/delete-contribution.action";
import { dashboardPageSize } from "@/config/pagination.config";
import type { ContributionRoleOption, ContributionsResult } from "@/lib/data/contributions";
import { dateToCalendarDate } from "@/lib/date";
import { useRouter } from "@/lib/navigation/navigation";

interface ContributionsPageProps {
	contributions: ContributionsResult;
	roleOptions: Array<ContributionRoleOption>;
	dir: "asc" | "desc";
	page: number;
	q: string;
	sort:
		| "personName"
		| "roleType"
		| "organisationalUnitType"
		| "organisationalUnitName"
		| "durationStart"
		| "durationEnd";
}

type ContributionItem = ContributionsResult["data"][number];

interface ContributionDialogState {
	isOpen: boolean;
	item: ContributionItem | null;
	person: AsyncOption | null;
	roleTypeId: string | null;
	organisationalUnit: AsyncOption | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: ContributionDialogState = {
	isOpen: false,
	item: null,
	person: null,
	roleTypeId: null,
	organisationalUnit: null,
	durationStart: null,
	durationEnd: null,
};

function formatRoleType(type: string): string {
	return type.replaceAll("_", " ");
}

function formatOrganisationalUnitType(type: string): string {
	return type.replaceAll("_", " ");
}

function organisationalUnitTypeIntent(
	type: string,
): "amber" | "danger" | "emerald" | "info" | "pink" | "rose" | "secondary" | "slate" | "violet" {
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

function getOrganisationalUnitEditHref(type: string, slug: string): string | null {
	switch (type) {
		case "country": {
			return `/dashboard/administrator/countries/${slug}/edit`;
		}
		case "governance_body": {
			return `/dashboard/administrator/governance-bodies/${slug}/edit`;
		}
		case "institution": {
			return `/dashboard/administrator/institutions/${slug}/edit`;
		}
		case "national_consortium": {
			return `/dashboard/administrator/national-consortia/${slug}/edit`;
		}
		case "working_group": {
			return `/dashboard/administrator/working-groups/${slug}/edit`;
		}
		default: {
			return null;
		}
	}
}

const pageSize = dashboardPageSize;

async function fetchPersonOptionsPage(
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
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

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

async function fetchOrganisationalUnitOptionsPage(
	roleTypeId: string | null,
	params: Readonly<AsyncOptionsFetchPageParams>,
): Promise<{ items: Array<AsyncOption>; total: number }> {
	if (roleTypeId == null) {
		return { items: [], total: 0 };
	}

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
		throw new Error("Failed to load organisational units.");
	}

	return (await response.json()) as { items: Array<AsyncOption>; total: number };
}

export function ContributionsPage(props: Readonly<ContributionsPageProps>): ReactNode {
	const {
		contributions,
		roleOptions,
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const router = useRouter();
	const [items, optimisticallyRemoveItem] = useOptimistic(contributions.data, (state, id: string) =>
		state.filter((item) => item.id !== id),
	);
	const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<ContributionDialogState>(emptyDialog);
	const [formState, setFormState] = useState<ActionState>(() => createActionStateInitial());
	const search = useUrlPaginatedSearch({
		dir: initialDir,
		page: initialPage,
		q: initialQ,
		sort: initialSort,
	});
	const [isDeletePending, startDeleteTransition] = useTransition();
	const [isFormPending, startFormTransition] = useTransition();

	function openCreateDialog() {
		setDialog(emptyDialog);
		setFormState(createActionStateInitial());
		setDialog((prev) => {
			return { ...prev, isOpen: true };
		});
	}

	function openEditDialog(item: ContributionItem) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			person: { id: item.personDocumentId, name: item.personName },
			roleTypeId: item.roleTypeId,
			organisationalUnit: {
				id: item.organisationalUnitDocumentId,
				name: item.organisationalUnitName,
				description: formatOrganisationalUnitType(item.organisationalUnitType),
			},
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		startFormTransition(async () => {
			const newState =
				dialog.item == null
					? await createContributionAction(formState, formData)
					: await updateContributionAction(formState, formData);

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
				title={t("Person relations")}
				description={t("All person-to-organisation relations in the knowledge base.")}
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
				aria-label="contributions"
				className="[--gutter:var(--layout-padding)] sm:[--gutter:var(--layout-padding)]"
				onSortChange={search.setSortDescriptor}
				sortDescriptor={search.sortDescriptor}
			>
				<TableHeader>
					<TableColumn
						allowsSorting={true}
						className="max-inline-80"
						id="personName"
						isRowHeader={true}
					>
						{t("Person")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="roleType">
						{t("Role")}
					</TableColumn>
					<TableColumn allowsSorting={true} id="organisationalUnitType">
						{t("Type")}
					</TableColumn>
					<TableColumn allowsSorting={true} className="max-inline-80" id="organisationalUnitName">
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
					{(item) => {
						const organisationalUnitEditHref = getOrganisationalUnitEditHref(
							item.organisationalUnitType,
							item.organisationalUnitSlug,
						);

						return (
							<TableRow id={item.id}>
								<TableCell>
									<div className="max-inline-80 truncate" title={item.personName}>
										{item.personName}
									</div>
								</TableCell>
								<TableCell>{formatRoleType(item.roleType)}</TableCell>
								<TableCell>
									<Badge intent={organisationalUnitTypeIntent(item.organisationalUnitType)}>
										{formatOrganisationalUnitType(item.organisationalUnitType)}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="max-inline-80 truncate" title={item.organisationalUnitName}>
										{item.organisationalUnitName}
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
										<RowActionsMenu.Link
											href={`/dashboard/administrator/persons/${item.personSlug}/edit`}
											icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
										>
											{t("Edit person")}
										</RowActionsMenu.Link>
										<RowActionsMenu.Action
											icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
											onAction={() => {
												openEditDialog(item);
											}}
										>
											{t("Edit relation")}
										</RowActionsMenu.Action>
										{organisationalUnitEditHref != null ? (
											<RowActionsMenu.Link
												href={organisationalUnitEditHref}
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
											>
												{t("Edit organisation")}
											</RowActionsMenu.Link>
										) : null}
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
						);
					}}
				</TableBody>
			</Table>

			<EntityListPagination search={search} total={contributions.total} pageSize={pageSize} />

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
					description={t("Select a person, organisation, role, and duration.")}
				/>
				<Form action={formAction} state={formState}>
					<ModalBody className="flex flex-col gap-y-4">
						{dialog.item != null ? <input name="id" type="hidden" value={dialog.item.id} /> : null}
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
									return {
										...prev,
										roleTypeId: String(key),
										organisationalUnit: null,
									};
								});
							}}
							value={dialog.roleTypeId}
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
						<input name="roleTypeId" type="hidden" value={dialog.roleTypeId ?? ""} />
						<AsyncSelect
							aria-label={t("Organisation")}
							cacheKey={dialog.roleTypeId ?? "none"}
							emptyMessage={t("No organisations found.")}
							fetchPage={(params) => fetchOrganisationalUnitOptionsPage(dialog.roleTypeId, params)}
							initialItems={[]}
							initialTotal={0}
							isDisabled={dialog.roleTypeId == null}
							isRequired={true}
							label={t("Organisation")}
							loadOnMount={dialog.roleTypeId != null}
							onSelect={(item) => {
								setDialog((prev) => {
									return { ...prev, organisationalUnit: item };
								});
							}}
							placeholder={t("No organisation selected")}
							selectedItem={dialog.organisationalUnit}
						/>
						<input
							name="organisationalUnitDocumentId"
							type="hidden"
							value={dialog.organisationalUnit?.id ?? ""}
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
				model={t("person relation")}
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
							await deleteContributionAction(id);
							router.refresh();
							setItemToDelete(null);
						} catch {
							setDeleteError(t("Could not delete person relation. Please try again."));
						}
					});
				}}
			/>
		</Fragment>
	);
}
