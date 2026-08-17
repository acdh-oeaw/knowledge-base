"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { ResetPasswordActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/reset-password/_lib/reset-password.schema";
import { auth } from "@/lib/auth";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const resetPasswordAction = createServerAction(
	async function resetPasswordAction(state, formData) {
		const locale = await getLocale();
		const t = await getExtracted();

		if (!(await globalPostRequestRateLimit())) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const { session: passwordResetSession, user } =
			await auth.validatePasswordResetSessionFromRequest();

		if (passwordResetSession == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}
		if (!passwordResetSession.isEmailVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}
		if (user.isTwoFactorRegistered && !passwordResetSession.isTwoFactorVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}

		const result = await v.safeParseAsync(
			ResetPasswordActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof ResetPasswordActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { password } = result.output;

		const isStrongPassword = await auth.verifyPasswordStrength(password);
		if (!isStrongPassword) {
			return createActionStateError({ message: t("Weak password.") });
		}

		await auth.deleteUserPasswordResetSessions(passwordResetSession.userId);
		await auth.deleteUserSessions(passwordResetSession.userId);
		await auth.updatePassword(passwordResetSession.userId, password);

		const session = await auth.createSession(user.id, passwordResetSession.isTwoFactorVerified);
		await auth.setSessionCookie(session.token, session.expiresAt);
		await auth.deletePasswordResetSessionCookie();

		redirect({ href: "/dashboard", locale });
	},
);
