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
import { deleteProjectAffiliationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-affiliations/_lib/delete-project-affiliation.action";
import { upsertProjectAffiliationAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/project-affiliations/_lib/upsert-project-affiliation.action";
import type { ContributionPersonOption } from "@/lib/data/contributions";
import { dateToCalendarDate } from "@/lib/date";

interface ProjectAffiliation {
	id: string;
	personDocumentId: string;
	personName: string;
	durationStart: Date | null;
	durationEnd: Date | null;
}

interface ProjectAffiliationsSectionProps {
	projectDocumentId: string;
	affiliations: Array<ProjectAffiliation>;
}

interface DialogState {
	isOpen: boolean;
	item: ProjectAffiliation | null;
	person: AsyncOption | null;
	durationStart: CalendarDate | null;
	durationEnd: CalendarDate | null;
}

const emptyDialog: DialogState = {
	isOpen: false,
	item: null,
	person: null,
	durationStart: null,
	durationEnd: null,
};

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

	const result = (await response.json()) as {
		items: Array<ContributionPersonOption>;
		total: number;
	};

	// `AsyncSelect`'s `fetchPage`, `selectedItem`, and `onSelect` all share one type parameter — map
	// down to the minimal `AsyncOption` shape (this component only ever reads `id`/`name`) so it
	// resolves consistently instead of pinning to `ContributionPersonOption`'s full, unused shape.
	return {
		items: result.items.map((item) => {
			return { id: item.id, name: item.name };
		}),
		total: result.total,
	};
}

export function ProjectAffiliationsSection(
	props: Readonly<ProjectAffiliationsSectionProps>,
): ReactNode {
	const { projectDocumentId, affiliations } = props;

	const t = useExtracted();
	const format = useFormatter();

	const [items, setItems] = useState(affiliations);

	const table = useClientTable({
		items,
		sortAccessors: {
			from: (item) => item.durationStart,
			person: (item) => item.personName,
			until: (item) => item.durationEnd,
		},
	});

	const [dialog, setDialog] = useState<DialogState>(emptyDialog);
	const [formState, setFormState] = useState<ActionState>(() => createActionStateInitial());
	const [itemToDelete, setItemToDelete] = useState<ProjectAffiliation | null>(null);
	const [isFormPending, startFormTransition] = useTransition();
	const [isDeletePending, startDeleteTransition] = useTransition();

	function openCreateDialog() {
		setFormState(createActionStateInitial());
		setDialog({ ...emptyDialog, isOpen: true });
	}

	function openEditDialog(item: ProjectAffiliation) {
		setFormState(createActionStateInitial());
		setDialog({
			isOpen: true,
			item,
			person: { id: item.personDocumentId, name: item.personName },
			durationStart: dateToCalendarDate(item.durationStart),
			durationEnd: dateToCalendarDate(item.durationEnd),
		});
	}

	function formAction(formData: FormData) {
		const person = dialog.person;

		startFormTransition(async () => {
			const newState = await upsertProjectAffiliationAction(formState, formData);
			setFormState(newState);

			if (newState.status === "success" && person != null) {
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
			<div className="space-y-6 max-inline-3xl">
				<div className="space-y-1">
					<FormSectionTitle title={t("Affiliated people")} />
				</div>

				{items.length > 0 ? (
					<Table
						aria-label="affiliated people"
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
							<TableColumn allowsSorting={true} id="from">
								{t("From")}
							</TableColumn>
							<TableColumn allowsSorting={true} id="until">
								{t("Until")}
							</TableColumn>
							<TableColumn className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end" />
						</TableHeader>
						<TableBody items={table.pageItems}>
							{(item) => (
								<TableRow id={item.id}>
									<TableCell>
										<div className="truncate max-inline-80" title={item.personName}>
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
									<TableCell className="sticky inset-e-0 z-10 bg-linear-to-l from-bg from-60% text-end">
										<RowActionsMenu>
											<RowActionsMenu.Action
												icon={<PencilSquareIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													openEditDialog(item);
												}}
											>
												{t("Edit affiliation")}
											</RowActionsMenu.Action>
											<RowActionsMenu.Separator />
											<RowActionsMenu.Action
												danger={true}
												icon={<TrashIcon className="me-2 block-4 inline-4" />}
												onAction={() => {
													setItemToDelete(item);
												}}
											>
												{t("Delete affiliation")}
											</RowActionsMenu.Action>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				) : (
					<p className="text-sm text-neutral-500">{t("No affiliated people.")}</p>
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
						description={t("Affiliate a person with this project.")}
						title={t("Add affiliation")}
						variant="stacked"
					>
						<Button className="self-start" onPress={openCreateDialog}>
							<PlusIcon />
							{t("Add affiliation")}
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
					title={dialog.item == null ? t("Add affiliation") : t("Edit affiliation")}
					description={t("Select the person and optional duration.")}
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
					title={t("Delete affiliation")}
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
								await deleteProjectAffiliationAction(id);
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
