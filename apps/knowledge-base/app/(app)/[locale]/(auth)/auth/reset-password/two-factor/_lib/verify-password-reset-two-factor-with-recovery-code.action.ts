"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { VerifyPasswordResetTwoFactorWithRecoveryCodeActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/reset-password/two-factor/_lib/verify-password-reset-two-factor-with-recovery-code.schema";
import { auth } from "@/lib/auth";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const verifyPasswordResetTwoFactorWithRecoveryCodeAction = createServerAction(
	async function verifyPasswordResetTwoFactorWithRecoveryCodeAction(state, formData) {
		const locale = await getLocale();
		const t = await getExtracted();

		if (!(await globalPostRequestRateLimit())) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const { session, user } = await auth.validatePasswordResetSessionFromRequest();

		if (session == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}
		if (!session.isEmailVerified || !user.isTwoFactorRegistered || session.isTwoFactorVerified) {
			return createActionStateError({ message: "Forbidden" });
		}

		if (!auth.recoveryCodeBucket.check(session.userId, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const result = await v.safeParseAsync(
			VerifyPasswordResetTwoFactorWithRecoveryCodeActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<
				typeof VerifyPasswordResetTwoFactorWithRecoveryCodeActionInputSchema
			>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { code } = result.output;

		if (!auth.recoveryCodeBucket.consume(session.userId, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const valid = await auth.resetUserTwoFactorWithRecoveryCode(session.userId, code);
		if (!valid) {
			return createActionStateError({ message: t("Incorrect code.") });
		}

		auth.recoveryCodeBucket.reset(session.userId);

		redirect({ href: "/auth/reset-password", locale });
	},
);
