"use client";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { personSocialMediaTypesEnum } from "@dariah-eric/database/schema";
import { Button } from "@dariah-eric/ui/button";
import { FieldError, Label } from "@dariah-eric/ui/field";
import {
	GridList,
	GridListDescription,
	GridListItem,
	GridListLabel,
	GridListStart,
} from "@dariah-eric/ui/grid-list";
import { Input } from "@dariah-eric/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@dariah-eric/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useState } from "react";
import { Button as AriaButton, Form as AriaForm, useDragAndDrop } from "react-aria-components";
import * as v from "valibot";

import { FormSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/form-section";
import type { PersonSocialMediaEntry } from "@/lib/data/person-social-media";
import { PersonSocialMediaEntryInputSchema } from "@/lib/person-social-media-input";
import { getSocialMediaTypeLabel } from "@/lib/social-media-type-label";

/**
 * Entries are edited one at a time in a dialog and submitted as hidden inputs, so a row only needs
 * a stable client-side key: it identifies the row while reordering and while the dialog edits it.
 */
interface EntryRow extends PersonSocialMediaEntry {
	key: string;
}

interface PersonSocialMediaFieldsProps {
	initialSocialMedia?: Array<PersonSocialMediaEntry>;
}

/**
 * Editor for a person's own social media. Unlike the shared social media picker there is nothing to
 * search for and nothing to reuse — these entries belong to the person alone, so each is typed into
 * the dialog. Row order becomes `person_social_media.position`.
 */
export function PersonSocialMediaFields(props: Readonly<PersonSocialMediaFieldsProps>): ReactNode {
	const { initialSocialMedia } = props;

	const t = useExtracted();

	const [rows, setRows] = useState<Array<EntryRow>>(() =>
		(initialSocialMedia ?? []).map((entry, index) => {
			return { ...entry, key: `initial-${String(index)}` };
		}),
	);
	const [nextKey, setNextKey] = useState(0);
	/** The row the dialog is editing, or `null` when it adds a new one. Closed while `undefined`. */
	const [editedRow, setEditedRow] = useState<EntryRow | null | undefined>(undefined);

	const { dragAndDropHooks } = useDragAndDrop({
		getItems: (keys) =>
			[...keys].map((key) => {
				return { "text/plain": String(key) };
			}),
		onReorder(event) {
			setRows((prev) => {
				const moving = prev.filter((row) => event.keys.has(row.key));
				const remaining = prev.filter((row) => !event.keys.has(row.key));
				const targetIndex = remaining.findIndex((row) => row.key === String(event.target.key));
				const insertAt = event.target.dropPosition === "before" ? targetIndex : targetIndex + 1;

				return [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)];
			});
		},
	});

	function handleSubmitEntry(entry: PersonSocialMediaEntry) {
		const edited = editedRow;

		setRows((prev) => {
			if (edited == null) {
				return [...prev, { ...entry, key: `new-${String(nextKey)}` }];
			}

			return prev.map((row) => (row.key === edited.key ? { ...entry, key: row.key } : row));
		});

		if (edited == null) {
			setNextKey((prev) => prev + 1);
		}

		setEditedRow(undefined);
	}

	return (
		<FormSection
			description={t("Add the person's own website and social media profiles.")}
			title={t("Social media")}
		>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-fg">{t("No social media added")}</p>
			) : (
				<GridList
					aria-label={t("Social media")}
					className="inline-full"
					// React Aria caches a row's rendered content per item object and does not re-invoke
					// the render function while the object stays the same, so the list is named here to
					// keep an untouched row from holding on to markup produced before its neighbours moved.
					dependencies={[rows]}
					dragAndDropHooks={dragAndDropHooks}
					items={rows}
				>
					{(row) => (
						<GridListItem className="inline-full" id={row.key} textValue={row.url}>
							<GridListStart className="flex-1 min-inline-0">
								<div className="flex flex-col min-inline-0">
									<GridListLabel className="truncate">
										{row.label ?? getSocialMediaTypeLabel(row.type)}
									</GridListLabel>
									<GridListDescription className="truncate">
										{row.label != null
											? `${getSocialMediaTypeLabel(row.type)} · ${row.url}`
											: row.url}
									</GridListDescription>
								</div>
							</GridListStart>

							<AriaButton
								aria-label={t("Edit entry")}
								className="grid shrink-0 cursor-default place-content-center rounded-md text-muted-fg block-7 inline-7 hover:bg-muted hover:text-fg"
								onPress={() => {
									setEditedRow(row);
								}}
							>
								<PencilSquareIcon className="block-4 inline-4" />
							</AriaButton>

							<AriaButton
								aria-label={t("Remove entry")}
								className="grid shrink-0 cursor-default place-content-center rounded-md text-muted-fg block-7 inline-7 hover:bg-muted hover:text-fg"
								onPress={() => {
									setRows((prev) => prev.filter((entry) => entry.key !== row.key));
								}}
							>
								<TrashIcon className="block-4 inline-4" />
							</AriaButton>
						</GridListItem>
					)}
				</GridList>
			)}

			<Button
				className="self-start"
				intent="outline"
				onPress={() => {
					setEditedRow(null);
				}}
			>
				<PlusIcon />
				{t("Add entry")}
			</Button>

			{rows.map((row, index) => (
				<Fragment key={row.key}>
					<input name={`socialMedia.${String(index)}.type`} type="hidden" value={row.type} />
					<input name={`socialMedia.${String(index)}.url`} type="hidden" value={row.url} />
					{row.label != null ? (
						<input name={`socialMedia.${String(index)}.label`} type="hidden" value={row.label} />
					) : null}
				</Fragment>
			))}

			<PersonSocialMediaEntryDialog
				entry={editedRow ?? null}
				isOpen={editedRow !== undefined}
				onClose={() => {
					setEditedRow(undefined);
				}}
				onSubmit={handleSubmitEntry}
				takenUrls={rows.filter((row) => row.key !== editedRow?.key).map((row) => row.url)}
			/>
		</FormSection>
	);
}

interface PersonSocialMediaEntryDialogProps {
	/** The entry being edited, or `null` when a new one is added. */
	entry: PersonSocialMediaEntry | null;
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (entry: PersonSocialMediaEntry) => void;
	/** Urls of the other entries. The person's entries must have distinct urls. */
	takenUrls: Array<string>;
}

function PersonSocialMediaEntryDialog(
	props: Readonly<PersonSocialMediaEntryDialogProps>,
): ReactNode {
	const { entry, isOpen, onClose, onSubmit, takenUrls } = props;

	const t = useExtracted();

	const [urlError, setUrlError] = useState<string | null>(null);

	function handleSubmit(formData: FormData) {
		const result = v.safeParse(PersonSocialMediaEntryInputSchema, getFormDataValues(formData));

		if (!result.success) {
			setUrlError(t("Enter a valid url."));
			return;
		}

		if (takenUrls.includes(result.output.url)) {
			setUrlError(t("This url has already been added."));
			return;
		}

		setUrlError(null);
		onSubmit(result.output);
	}

	return (
		<ModalContent
			isOpen={isOpen}
			onOpenChange={(open) => {
				if (!open) {
					setUrlError(null);
					onClose();
				}
			}}
			size="lg"
		>
			{/* The modal unmounts its content when closed, so the fields start from `entry` each time. */}
			<AriaForm
				onSubmit={(event) => {
					event.preventDefault();
					// The dialog is portaled, but its submit event still bubbles up the react tree, where
					// the person form is an ancestor.
					event.stopPropagation();

					handleSubmit(new FormData(event.currentTarget));
				}}
			>
				<ModalHeader
					description={t("Enter a website or social media profile of the person.")}
					title={entry != null ? t("Edit social media") : t("Add social media")}
				/>

				<ModalBody className="flex flex-col gap-y-5">
					{/* `defaultSelectedKey` is flagged deprecated, but the plural form is typed for
					    `selectionMode="multiple"` only, so it is still the single-select API here. */}
					<Select defaultSelectedKey={entry?.type ?? "website"} isRequired={true} name="type">
						<Label>{t("Type")}</Label>
						<SelectTrigger />
						<FieldError />
						<SelectContent>
							{personSocialMediaTypesEnum.map((type) => (
								<SelectItem key={type} id={type}>
									{getSocialMediaTypeLabel(type)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<TextField
						defaultValue={entry?.url}
						isInvalid={urlError != null}
						isRequired={true}
						name="url"
						onChange={() => {
							setUrlError(null);
						}}
					>
						<Label>{t("URL")}</Label>
						<Input placeholder="https://" />
						<FieldError>{urlError}</FieldError>
					</TextField>

					<TextField defaultValue={entry?.label ?? undefined} name="label">
						<Label>{t("Label (optional)")}</Label>
						<Input />
						<FieldError />
					</TextField>
				</ModalBody>

				<ModalFooter>
					<ModalClose>{t("Cancel")}</ModalClose>

					<Button type="submit">{entry != null ? t("Save") : t("Add")}</Button>
				</ModalFooter>
			</AriaForm>
		</ModalContent>
	);
}
