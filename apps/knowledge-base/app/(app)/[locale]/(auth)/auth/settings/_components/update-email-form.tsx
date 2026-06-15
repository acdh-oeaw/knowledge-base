"use client";

import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { FieldError, Label } from "@acdh-knowledge-base/ui/field";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { Input } from "@acdh-knowledge-base/ui/input";
import { SubmitButton } from "@acdh-knowledge-base/ui/submit-button";
import { TextField } from "@acdh-knowledge-base/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { updateEmailAction } from "@/app/(app)/[locale]/(auth)/auth/settings/_lib/update-email.action";

export function UpdateEmailForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(updateEmailAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField autoComplete="email" isRequired={true} name="email" type="email">
				<Label>{t("New email")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Update")}</SubmitButton>
		</Form>
	);
}
