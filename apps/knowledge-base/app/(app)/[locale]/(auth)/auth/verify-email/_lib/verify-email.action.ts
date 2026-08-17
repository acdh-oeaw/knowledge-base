"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { VerifyEmailActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/verify-email/_lib/verify-email.schema";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const verifyEmailAction = createServerAction(
	async function verifyEmailAction(state, formData) {
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
		if (!auth.verifyEmailBucket.check(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		let verificationRequest = await auth.getEmailVerificationRequestFromRequest();

		if (verificationRequest == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}

		const result = await v.safeParseAsync(
			VerifyEmailActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof VerifyEmailActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { code } = result.output;

		if (!auth.verifyEmailBucket.consume(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const now = Date.now();
		if (now >= verificationRequest.expiresAt.getTime()) {
			verificationRequest = await auth.createEmailVerificationRequest(
				verificationRequest.userId,
				verificationRequest.email,
			);

			await auth.sendVerificationEmail(verificationRequest.email, verificationRequest.code);

			return createActionStateError({
				message: t("The verification code was expired. We sent another code to your inbox."),
			});
		}

		if (verificationRequest.code !== code) {
			return createActionStateError({ message: t("Incorrect code.") });
		}

		await auth.deleteEmailVerificationRequest(user.id);
		await auth.deletePasswordResetSessions(user.id);
		await auth.updateEmailAndSetEmailAsVerified(user.id, verificationRequest.email);
		await auth.deleteEmailVerificationRequestCookie();

		if (!user.isTwoFactorRegistered) {
			redirect({ href: "/auth/two-factor/setup", locale });
		}

		redirect({ href: "/dashboard", locale });
	},
);
