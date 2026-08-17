"use client";

import { createActionStateInitial, isActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { SubmitButton } from "@dariah-eric/ui/submit-button";
import { Text } from "@dariah-eric/ui/text";
import { useExtracted } from "next-intl";
import { type ReactNode, useActionState } from "react";

import { regenerateRecoveryCodeAction } from "@/app/(app)/[locale]/(auth)/auth/settings/_lib/regenerate-recovery-code.action";

interface RecoveryCodeFormProps {
	recoveryCode: string | null;
}

export function RecoveryCodeForm(props: Readonly<RecoveryCodeFormProps>): ReactNode {
	const { recoveryCode } = props;

	const t = useExtracted();

	const [state, action] = useActionState(regenerateRecoveryCodeAction, createActionStateInitial());

	const newRecoveryCode = isActionStateSuccess(state)
		? ((state.formData?.get("recovery-code") as string | null) ?? null)
		: null;

	return (
		<Form action={action} className="flex flex-col gap-y-6" state={state}>
			<FormStatus state={state} />

			{newRecoveryCode != null || recoveryCode != null ? (
				<Text>
					{t("Your recovery code is:")}{" "}
					<span className="text-fg">{newRecoveryCode ?? recoveryCode}</span>
				</Text>
			) : null}

			<SubmitButton className="mbs-2">{t("Generate new code")}</SubmitButton>
		</Form>
	);
}
