"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import * as v from "valibot";

import { VerifyTwoFactorActionInputSchema } from "@/app/(app)/[locale]/(auth)/auth/two-factor/_lib/verify-two-factor.schema";
import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getIntlLanguage } from "@/lib/i18n/locales";
import { redirect } from "@/lib/navigation/navigation";
import { createServerAction } from "@/lib/server/create-server-action";

const totpBucket = auth.totpBucket;

export const verifyTwoFactorAction = createServerAction(
	async function verifyTwoFactorAction(state, formData) {
		const locale = await getLocale();
		const t = await getExtracted();

		if (!(await globalPostRequestRateLimit())) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const { session, user } = await getCurrentSession();

		if (session == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}

		if (!user.isEmailVerified || !user.isTwoFactorRegistered || session.isTwoFactorVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}

		if (!totpBucket.check(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const result = await v.safeParseAsync(
			VerifyTwoFactorActionInputSchema,
			getFormDataValues(formData),
			{ lang: getIntlLanguage(locale) },
		);

		if (!result.success) {
			const errors = v.flatten<typeof VerifyTwoFactorActionInputSchema>(result.issues);

			return createActionStateError({
				message: errors.root ?? t("Invalid or missing fields."),
				validationErrors: errors.nested,
			});
		}

		const { code } = result.output;

		if (!totpBucket.consume(user.id, 1)) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const totpKey = await auth.getUserTotpKey(user.id);

		if (totpKey == null) {
			return createActionStateError({ message: t("Forbidden.") });
		}

		if (!auth.verifyTotp(totpKey, code)) {
			return createActionStateError({ message: t("Incorrect code.") });
		}

		totpBucket.reset(user.id);

		await auth.setSessionAsTwoFactorVerified(session.id);

		redirect({ href: "/dashboard", locale });
	},
);
