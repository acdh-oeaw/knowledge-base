"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import { headers } from "next/headers";
import * as v from "valibot";

import { SignUpActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/sign-up/_lib/sign-up.schema";
import { env } from "@/config/env.config";
import { auth } from "@/lib/auth";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

const signUpIpBucket = auth.signUpIpBucket;

export const signUpAction = createServerAction(async function signUpAction(state, formData) {
	const locale = await getLocale();
	const t = await getExtracted();

	if (env.AUTH_SIGN_UP !== "enabled") {
		return createActionStateError({ message: t("Sign up is disabled.") });
	}

	if (!(await globalPostRequestRateLimit())) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const ip = (await headers()).get("x-forwarded-for");
	if (ip != null && !signUpIpBucket.check(ip, 1)) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const result = await v.safeParseAsync(SignUpActionInputSchema, getFormDataValues(formData), {
		lang: getIntlLanguage(locale),
	});

	if (!result.success) {
		const errors = v.flatten<typeof SignUpActionInputSchema>(result.issues);

		return createActionStateError({
			message: errors.root ?? t("Invalid or missing fields."),
			validationErrors: errors.nested,
		});
	}

	const { email, password, name } = result.output;

	const isEmailAvailable = await auth.isEmailAvailable(email);
	if (!isEmailAvailable) {
		return createActionStateError({ message: t("Email is already used.") });
	}

	const isStrongPassword = await auth.verifyPasswordStrength(password);
	if (!isStrongPassword) {
		return createActionStateError({ message: t("Weak password.") });
	}

	if (ip != null && !signUpIpBucket.consume(ip, 1)) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const user = await auth.createUser(email, name, password);
	const emailVerificationRequest = await auth.createEmailVerificationRequest(user.id, user.email);
	await auth.sendVerificationEmail(emailVerificationRequest.email, emailVerificationRequest.code);
	await auth.setEmailVerificationRequestCookie(
		emailVerificationRequest.token,
		emailVerificationRequest.expiresAt,
	);

	const session = await auth.createSession(user.id);
	await auth.setSessionCookie(session.token, session.expiresAt);

	redirect({ href: "/auth/two-factor/setup", locale });
});
