"use client";

import type * as schema from "@dariah-eric/database/schema";
import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { FieldError, Label, fieldErrorStyles } from "@dariah-eric/ui/field";
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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@dariah-eric/ui/select";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState, useState } from "react";

import { DraftFormSubmitButtons } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/draft-form-submit-buttons";
import { MediaLibraryDialog } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/media-library-dialog";
import { createDocumentOrPolicyFromDialogAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-or-policy-from-dialog.action";
import { updateDocumentOrPolicyDetailsAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-or-policy-details.action";

export interface DocumentOrPolicyDialogItem {
	id: string;
	title: string;
	summary: string | null;
	url: string | null;
	groupId: string | null;
	document: { key: string; label: string };
}

interface DocumentOrPolicyFormProps {
	item?: DocumentOrPolicyDialogItem | null;
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
	initialGroupId?: string | null;
	initialAssets: Array<{ key: string; label: string; url: string }>;
	onSuccess: () => void;
}

function DocumentOrPolicyForm(props: Readonly<DocumentOrPolicyFormProps>): ReactNode {
	const { item, groups, initialGroupId, initialAssets, onSuccess } = props;

	const t = useExtracted();

	const isEditMode = item != null;

	const serverAction = isEditMode
		? updateDocumentOrPolicyDetailsAction
		: createDocumentOrPolicyFromDialogAction;

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await serverAction(prevState, formData);
			if (result.status === "success") {
				onSuccess();
			}
			return result;
		},
		createActionStateInitial(),
	);

	const [selectedDocument, setSelectedDocument] = useState<{ key: string; label: string } | null>(
		item?.document ?? null,
	);

	const [selectedGroupId, setSelectedGroupId] = useState<string>(
		item?.groupId ?? initialGroupId ?? "",
	);

	const [documentKeyError, setDocumentKeyError] = useState(false);

	const title = isEditMode ? t("Edit document or policy") : t("New document or policy");

	return (
		<Form action={formAction} state={state}>
			<ModalHeader title={title} />

			<ModalBody className="flex flex-col gap-y-4">
				<FormStatus state={state} />

				{isEditMode && <input name="id" type="hidden" value={item.id} />}

				<TextField defaultValue={item?.title ?? undefined} isRequired={true} name="title">
					<Label>{t("Title")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<TextField defaultValue={item?.summary ?? undefined} name="summary">
					<Label>{t("Summary")}</Label>
					<Input />
					<FieldError />
				</TextField>

				<TextField defaultValue={item?.url ?? undefined} name="url">
					<Label>{t("URL")}</Label>
					<Input placeholder="https://" />
					<FieldError />
				</TextField>

				<Select
					onChange={(key) => {
						setSelectedGroupId(String(key === "none" ? "" : key));
					}}
					value={selectedGroupId || "none"}
				>
					<Label>{t("Group")}</Label>
					<SelectTrigger />
					<FieldError />
					<SelectContent>
						<SelectItem id="none">{t("None")}</SelectItem>
						{groups.map((group) => (
							<SelectItem key={group.id} id={group.id}>
								{group.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{selectedGroupId ? <input name="groupId" type="hidden" value={selectedGroupId} /> : null}

				<div>
					<Label className="mbe-1.5 block text-sm font-medium">{t("Document")}</Label>
					{selectedDocument != null && (
						<p className="mbe-2 text-sm text-muted-fg">{selectedDocument.label}</p>
					)}
					<MediaLibraryDialog
						defaultPrefix="documents"
						initialAssets={initialAssets}
						onSelect={(key) => {
							const asset = initialAssets.find((a) => a.key === key);
							setSelectedDocument({ key, label: asset?.label ?? key });
						}}
						prefixes={["documents"]}
					/>
					<input
						aria-hidden={true}
						className="sr-only"
						name="documentKey"
						onInvalid={(e) => {
							e.preventDefault();
							setDocumentKeyError(true);
						}}
						readOnly={true}
						required={true}
						tabIndex={-1}
						value={selectedDocument?.key ?? ""}
					/>
					{documentKeyError ? (
						<div className={fieldErrorStyles()}>{t("Please select a document.")}</div>
					) : null}
				</div>
			</ModalBody>

			<ModalFooter>
				<ModalClose>{t("Cancel")}</ModalClose>
				<DraftFormSubmitButtons
					isDisabled={selectedDocument == null}
					isPending={isPending}
					showSaveAndPublish={!isEditMode}
				/>
			</ModalFooter>
		</Form>
	);
}

interface DocumentOrPolicyFormDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	item?: DocumentOrPolicyDialogItem | null;
	groups: Array<Pick<schema.DocumentPolicyGroup, "id" | "label">>;
	initialGroupId?: string | null;
	initialAssets: Array<{ key: string; label: string; url: string }>;
}

export function DocumentOrPolicyFormDialog(
	props: Readonly<DocumentOrPolicyFormDialogProps>,
): ReactNode {
	const { isOpen, onOpenChange, item, groups, initialGroupId, initialAssets } = props;

	const [formKey, setFormKey] = useState(0);

	function handleOpenChange(open: boolean) {
		if (open) {
			setFormKey((k) => k + 1);
		}
		onOpenChange(open);
	}

	return (
		<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="md">
			<DocumentOrPolicyForm
				key={`${String(formKey)}-${item?.id ?? "new"}`}
				groups={groups}
				initialAssets={initialAssets}
				initialGroupId={initialGroupId}
				item={item}
				onSuccess={() => {
					onOpenChange(false);
				}}
			/>
		</ModalContent>
	);
}
