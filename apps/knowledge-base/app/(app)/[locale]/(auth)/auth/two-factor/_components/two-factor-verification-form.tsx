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

import { verifyTwoFactorAction } from "@/app/(app)/[locale]/(auth)/auth/two-factor/_lib/verify-two-factor.action";

export function TwoFactorVerificationForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(verifyTwoFactorAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField autoComplete="one-time-code" autoFocus={true} isRequired={true} name="code">
				<Label>{t("Code")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Verify")}</SubmitButton>
		</Form>
	);
}
