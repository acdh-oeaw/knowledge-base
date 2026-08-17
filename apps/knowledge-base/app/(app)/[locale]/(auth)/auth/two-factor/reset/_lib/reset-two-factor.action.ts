"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { ResetTwoFactorActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/two-factor/reset/_lib/reset-two-factor.schema";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const resetTwoFactorAction = createServerAction(
	async function resetTwoFactorAction(state, formData) {
		const locale = await getLocale();
		const t = await getExtracted();

		const { session, user } = await getCurrentSession();

		if (session == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}
		if (!user.isEmailVerified || !user.isTwoFactorRegistered || session.isTwoFactorVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}
		if (!auth.recoveryCodeBucket.check(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const result = await v.safeParseAsync(
			ResetTwoFactorActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof ResetTwoFactorActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { code } = result.output;

		if (!auth.recoveryCodeBucket.consume(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const valid = await auth.resetUserTwoFactorWithRecoveryCode(user.id, code);
		if (!valid) {
			return createActionStateError({ message: t("Invalid recovery code.") });
		}

		auth.recoveryCodeBucket.reset(user.id);

		redirect({ href: "/auth/two-factor/setup", locale });
	},
);
