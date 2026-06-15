"use client";

import { type ActionState, createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { Button } from "@acdh-knowledge-base/ui/button";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import {
	ModalBody,
	ModalClose,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@acdh-knowledge-base/ui/modal";
import { ProgressCircle } from "@acdh-knowledge-base/ui/progress-circle";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState, useState } from "react";

import { createNavigationMenuAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/navigation/_lib/create-navigation-menu.action";

interface NavigationMenuFormProps {
	onSuccess: () => void;
}

function NavigationMenuForm(props: Readonly<NavigationMenuFormProps>): ReactNode {
	const { onSuccess } = props;

	const t = useExtracted();

	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await createNavigationMenuAction(prevState, formData);
			if (result.status === "success") {
				onSuccess();
			}
			return result;
		},
		createActionStateInitial(),
	);

	return (
		<Form action={formAction} state={state}>
			<ModalHeader description={t("Create a new navigation menu.")} title={t("New menu")} />

			<ModalBody className="flex flex-col gap-y-4">
				<FormStatus state={state} />

				<TextField isRequired={true} name="name">
					<Label>{t("Name")}</Label>
					<Input placeholder={t("e.g. main, footer")} />
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

export function NavigationMenuCreateDialog(): ReactNode {
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
				{t("New menu")}
			</Button>

			<ModalContent isOpen={isOpen} onOpenChange={handleOpenChange} size="sm">
				<NavigationMenuForm
					key={formKey}
					onSuccess={() => {
						setIsOpen(false);
					}}
				/>
			</ModalContent>
		</Fragment>
	);
}
