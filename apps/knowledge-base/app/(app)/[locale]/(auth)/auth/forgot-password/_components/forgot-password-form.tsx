"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { FieldError, Label } from "@dariah-eric/ui/field";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { Input } from "@dariah-eric/ui/input";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { TextField } from "@dariah-eric/ui/text-field";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { forgotPasswordAction } from "@/app/(app)/[locale]/(auth)/auth/forgot-password/_lib/forgot-password.action";

export function ForgotPasswordForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(forgotPasswordAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField autoComplete="email" isRequired={true} name="email" type="email">
				<Label>{t("Email")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Send")}</SubmitButton>
		</Form>
	);
}
