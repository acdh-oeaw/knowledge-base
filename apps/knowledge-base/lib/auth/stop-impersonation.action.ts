"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { endImpersonation } from "@/lib/auth/end-impersonation";
import { assertAuthenticated } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";

/**
 * Deliberately gated on `assertAuthenticated` rather than `assertAdmin`: while impersonating, the
 * effective user is not an admin, so requiring admin here would strand the admin inside the
 * impersonated session with no way back.
 */
export async function stopImpersonationAction(): Promise<void> {
	const { isImpersonating, realUser, session, user } = await assertAuthenticated();

	const locale = await getLocale();

	if (isImpersonating) {
		await endImpersonation({ session, impersonatedUser: user, realUser });
		revalidatePath("/[locale]/dashboard", "layout");
	}

	redirect({ href: "/dashboard", locale });
}
