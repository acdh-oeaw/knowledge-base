"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import { headers } from "next/headers";
import * as v from "valibot";

import { SignInActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/sign-in/_lib/sign-in.schema";
import { auth } from "@/lib/auth";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

export const signInAction = createServerAction(async function signInAction(state, formData) {
	const locale = await getLocale();
	const t = await getExtracted();

	if (!(await globalPostRequestRateLimit())) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const ip = (await headers()).get("x-forwarded-for");
	if (ip != null && !auth.signInIpBucket.check(ip, 1)) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const result = await v.safeParseAsync(SignInActionInputSchema, getFormDataValues(formData), {
		lang: getIntlLanguage(locale),
	});

	if (!result.success) {
		const errors = v.flatten<typeof SignInActionInputSchema>(result.issues);

		return createActionStateError({
			message: errors.root ?? t("Invalid or missing fields."),
			validationErrors: errors.nested,
		});
	}

	const { email, password } = result.output;

	const user = await auth.getUserByEmail(email);
	if (user == null) {
		return createActionStateError({ message: t("Account does not exist.") });
	}

	if (ip != null && !auth.signInIpBucket.consume(ip, 1)) {
		return createActionStateError({ message: t("Too many requests.") });
	}
	if (!auth.signInTrottler.consume(user.id)) {
		return createActionStateError({ message: t("Too many requests.") });
	}

	const passwordHash = await auth.getUserPasswordHash(user.id);
	const isValidPassword = await auth.verifyPasswordHash(passwordHash, password);
	if (!isValidPassword) {
		return createActionStateError({ message: t("Incorrect password.") });
	}

	auth.signInTrottler.reset(user.id);

	const session = await auth.createSession(user.id);
	await auth.setSessionCookie(session.token, session.expiresAt);

	if (!user.isEmailVerified) {
		redirect({ href: "/auth/verify-email", locale });
	}

	if (!user.isTwoFactorRegistered) {
		redirect({ href: "/auth/two-factor/setup", locale });
	}

	redirect({ href: "/auth/two-factor", locale });
});
