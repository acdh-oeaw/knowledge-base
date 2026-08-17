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

import { verifyPasswordResetEmailAction } from "@/app/(app)/[locale]/(auth)/auth/reset-password/verify-email/_lib/verify-password-reset-email.action";

export function PasswordResetEmailVerificationForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(
		verifyPasswordResetEmailAction,
		createActionStateInitial(),
	);

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField isRequired={true} name="code">
				<Label>{t("Code")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Verify")}</SubmitButton>
		</Form>
	);
}
