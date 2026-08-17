"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { createServerAction } from "@/lib/server/create-server-action";

export const resendEmailVerificationCodeAction = createServerAction(
	async function resendEmailVerificationCodeAction() {
		const t = await getExtracted();

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

		let verificationRequest = await auth.getEmailVerificationRequestFromRequest();

		if (verificationRequest == null) {
			if (user.isEmailVerified) {
				return createActionStateError({ message: t("Forbidden.") });
			}
			if (!auth.sendVerificationEmailBucket.consume(user.id, 1)) {
				return createActionStateError({ message: t("Too many requests.") });
			}

			verificationRequest = await auth.createEmailVerificationRequest(user.id, user.email);
		} else {
			if (!auth.sendVerificationEmailBucket.consume(user.id, 1)) {
				return createActionStateError({ message: t("Too many requests.") });
			}

			verificationRequest = await auth.createEmailVerificationRequest(
				user.id,
				verificationRequest.email,
			);
		}

		await auth.sendVerificationEmail(verificationRequest.email, verificationRequest.code);
		await auth.setEmailVerificationRequestCookie(
			verificationRequest.token,
			verificationRequest.expiresAt,
		);

		return createActionStateSuccess({ message: t("A new code was sent to your inbox.") });
	},
);
