"use client";

import { type ActionState, createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Button } from "@dariah-eric/ui/button";
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
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import { updateDocumentPolicyGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-policy-group.action";

interface DocumentPolicyGroupEditDialogProps {
	group: { id: string; label: string } | null;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

function DocumentPolicyGroupEditForm(
	props: Readonly<{ group: { id: string; label: string }; onSuccess: () => void }>,
): ReactNode {
	const { group, onSuccess } = props;

	const t = useExtracted();

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await updateDocumentPolicyGroupAction(prevState, formData);
			if (result.status === "success") {
				onSuccess();
			}
			return result;
		},
		createActionStateInitial(),
	);

	return (
		<Form action={formAction} state={state}>
			<ModalHeader description={t("Update the document group title.")} title={t("Edit group")} />

			<ModalBody className="flex flex-col gap-y-4">
				<FormStatus state={state} />

				<TextField isRequired={true} name="label" defaultValue={group.label}>
					<Label>{t("Label")}</Label>
					<Input placeholder={t("e.g. Selected DARIAH ERIC reports")} />
					<FieldError />
				</TextField>

				<input name="id" type="hidden" value={group.id} />
			</ModalBody>

			<ModalFooter>
				<ModalClose>{t("Cancel")}</ModalClose>
				<Button isPending={isPending} type="submit">
					{isPending ? (
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
	);
}

export function DocumentPolicyGroupEditDialog(
	props: Readonly<DocumentPolicyGroupEditDialogProps>,
): ReactNode {
	const { group, isOpen, onOpenChange } = props;

	return (
		<ModalContent isOpen={isOpen} onOpenChange={onOpenChange} size="sm">
			{group != null ? (
				<DocumentPolicyGroupEditForm
					key={group.id}
					group={group}
					onSuccess={() => {
						onOpenChange(false);
					}}
				/>
			) : null}
		</ModalContent>
	);
}
