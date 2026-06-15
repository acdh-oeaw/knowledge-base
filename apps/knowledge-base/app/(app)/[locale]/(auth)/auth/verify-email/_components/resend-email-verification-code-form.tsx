"use client";

import { createActionStateInitial } from "@acdh-knowledge-base/next-lib/actions";
import { Form } from "@acdh-knowledge-base/ui/form";
import { FormStatus } from "@acdh-knowledge-base/ui/form-status";
import { SubmitButton } from "@acdh-knowledge-base/ui/submit-button";
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
