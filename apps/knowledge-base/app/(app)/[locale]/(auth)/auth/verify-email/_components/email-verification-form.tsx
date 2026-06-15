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

import { verifyEmailAction } from "@/app/(app)/[locale]/(auth)/auth/verify-email/_lib/verify-email.action";

export function EmailVerificationForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(verifyEmailAction, createActionStateInitial());

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<TextField isRequired={true} name="code">
				<Label>{t("Verification code")}</Label>
				<FieldError />
				<Input />
			</TextField>

			<SubmitButton className="mbs-2">{t("Verify")}</SubmitButton>
		</Form>
	);
}
