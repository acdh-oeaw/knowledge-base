"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { UpdateEmailActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/settings/_lib/update-email.schema";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const updateEmailAction = createServerAction(
	async function updateEmailAction(state, formData) {
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
		if (!auth.sendVerificationEmailBucket.check(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const result = await v.safeParseAsync(
			UpdateEmailActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof UpdateEmailActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { email } = result.output;

		const emailAvailable = await auth.isEmailAvailable(email);
		if (!emailAvailable) {
			return createActionStateError({ message: t("Email is already used.") });
		}
		if (!auth.sendVerificationEmailBucket.consume(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const verificationRequest = await auth.createEmailVerificationRequest(user.id, email);
		await auth.sendVerificationEmail(verificationRequest.email, verificationRequest.code);
		await auth.setEmailVerificationRequestCookie(
			verificationRequest.token,
			verificationRequest.expiresAt,
		);

		redirect({ href: "/auth/verify-email", locale });
	},
);
