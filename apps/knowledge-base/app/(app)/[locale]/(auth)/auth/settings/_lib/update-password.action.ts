"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { UpdatePasswordActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/settings/_lib/update-password.schema";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { createServerAction } from "@/lib/server/create-server-action";

export const updatePasswordAction = createServerAction(
	async function updatePasswordAction(state, formData) {
		const locale = await getLocale();
		const t = await getExtracted();

		if (!(await globalPostRequestRateLimit())) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const { session, user } = await getCurrentSession();

		if (session == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}
		if (user.isTwoFactorRegistered && !session.isTwoFactorVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}
		if (!auth.passwordUpdateBucket.check(session.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const result = await v.safeParseAsync(
			UpdatePasswordActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdatePasswordActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { password, "new-password": newPassword } = result.output;

		const isStrongPassword = await auth.verifyPasswordStrength(newPassword);
		if (!isStrongPassword) {
			return createActionStateError({ message: t("Weak password.") });
		}

		if (!auth.passwordUpdateBucket.consume(session.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const passwordHash = await auth.getUserPasswordHash(user.id);
		const isValidPassword = await auth.verifyPasswordHash(passwordHash, password);
		if (!isValidPassword) {
			return createActionStateError({ message: t("Incorrect password.") });
		}

		auth.passwordUpdateBucket.reset(session.id);

		await auth.deleteUserSessions(user.id);
		await auth.updatePassword(user.id, newPassword);

		const newSession = await auth.createSession(user.id, session.isTwoFactorVerified);
		await auth.setSessionCookie(newSession.token, newSession.expiresAt);

		return createActionStateSuccess({ message: t("Updated password.") });
	},
);
