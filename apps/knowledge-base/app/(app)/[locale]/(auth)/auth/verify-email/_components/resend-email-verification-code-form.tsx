"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { resendEmailVerificationCodeAction } from "@/app/(app)/[locale]/(auth)/auth/verify-email/_lib/resend-email-verification-code.action";

export function ResendEmailVerificationCodeForm(): ReactNode {
	const t = useExtracted();

	const [state, action] = useActionState(
		resendEmailVerificationCodeAction,
		createActionStateInitial(),
	);

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			<SubmitButton className="mbs-2" intent="secondary">
				{t("Resend verification code")}
			</SubmitButton>
		</Form>
	);
}
