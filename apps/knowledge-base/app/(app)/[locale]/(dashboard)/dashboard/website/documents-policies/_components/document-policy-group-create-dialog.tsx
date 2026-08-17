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
import { PlusIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { createDocumentPolicyGroupAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-policy-group.action";

function DocumentPolicyGroupForm(props: Readonly<{ onSuccess: () => void }>): ReactNode {
	const { onSuccess } = props;

	const t = useExtracted();

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await createDocumentPolicyGroupAction(prevState, formData);
			if (result.status === "success") {
				onSuccess();
			}
			return result;
		},
		createActionStateInitial(),
	);

	return (
		<Form action={formAction} state={state}>
			<ModalHeader description={t("Create a new document group.")} title={t("New group")} />

			<ModalBody className="flex flex-col gap-y-4">
				<FormStatus state={state} />

				<TextField isRequired={true} name="label">
					<Label>{t("Label")}</Label>
					<Input placeholder={t("e.g. Selected DARIAH ERIC reports")} />
					<FieldError />
				</TextField>
			</ModalBody>

			<ModalFooter>
				<ModalClose>{t("Cancel")}</ModalClose>
				<Button isPending={isPending} type="submit">
					{isPending ? (
						<Fragment>
							<ProgressCircle aria-label={t("Creating...")} isIndeterminate={true} />
							<span aria-hidden={true}>{t("Creating...")}</span>
						</Fragment>
					) : (
						t("Create")
					)}
				</Button>
			</ModalFooter>
		</Form>
	);
}

export function DocumentPolicyGroupCreateDialog(): ReactNode {
	const t = useExtracted();

	const [isOpen, setIsOpen] = useState(false);
	const [formKey, setFormKey] = useState(0);

	function handleOpenChange(open: boolean) {
		if (open) {
			setFormKey((k) => k + 1);
		}
		setIsOpen(open);
	}

	return (
		<Fragment>
			<Button
				intent="secondary"
				onPress={() => {
					handleOpenChange(true);
				}}
			>
				<PlusIcon className="me-2 block-4 inline-4" />
				{t("New group")}
			</Button>

			<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="sm">
				<DocumentPolicyGroupForm
					key={formKey}
					onSuccess={() => {
						setIsOpen(false);
					}}
				/>
			</ModalContent>
		</Fragment>
	);
}
