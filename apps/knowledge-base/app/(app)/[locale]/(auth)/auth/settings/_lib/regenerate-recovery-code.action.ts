"use server";

import { createActionStateError, createActionStateSuccess } from "@dariah-eric/next-lib/actions";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted } from "next-intl/server";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { createServerAction } from "@/lib/server/create-server-action";

export const regenerateRecoveryCodeAction = createServerAction(
	async function regenerateRecoveryCodeAction() {
		const t = await getExtracted();

		if (!(await globalPostRequestRateLimit())) {
			return createActionStateError({ message: t("Too many requests.") });
		}

		const { isImpersonating, realUser: user, session } = await getCurrentSession();

		if (session == null) {
			return createActionStateError({ message: t("Not authenticated.") });
		}

		/**
		 * This action changes the credential behind the session, which is the admin's own account while
		 * impersonating -- never the account the UI is currently showing. Refuse rather than silently
		 * apply it to the wrong one of the two.
		 */
		if (isImpersonating) {
			return createActionStateError({
				message: t("Not available while signed in as another user."),
			});
		}
		if (!user.isEmailVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}
		if (!session.isTwoFactorVerified) {
			return createActionStateError({ message: t("Forbidden.") });
		}

		const recoveryCode = await auth.resetRecoveryCode(user.id);
		const formData = new FormData();
		formData.set("recovery-code", recoveryCode);

		return createActionStateSuccess({ formData });
	},
);
