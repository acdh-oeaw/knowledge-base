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

import { resetPasswordAction } from "@/app/(app)/[locale]/(auth)/auth/reset-password/_lib/reset-password.action";

export function ResetPasswordForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(resetPasswordAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField autoComplete="new-password" isRequired={true} name="password" type="password">
				<Label>{t("Password")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<TextField
				autoComplete="new-password"
				isRequired={true}
				name="password-confirmation"
				type="password"
			>
				<Label>{t("Confirm password")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Reset password")}</SubmitButton>
		</Form>
	);
}
