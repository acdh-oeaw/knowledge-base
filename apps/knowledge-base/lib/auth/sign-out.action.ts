"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { endImpersonation } from "@/lib/auth/end-impersonation";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";

export async function signOutAction(): Promise<void> {
	const locale = await getLocale();

	const { isImpersonating, realUser, session, user } = await getCurrentSession();

	if (session == null) {
		redirect({ href: "/", locale });
	}

	/**
	 * Signing out of an impersonated session means leaving the impersonation, not destroying the
	 * admin's own session -- otherwise "sign out" would log out an account other than the one the UI
	 * is showing, without the admin ever seeing their own account again.
	 */
	if (isImpersonating) {
		await endImpersonation({ session, impersonatedUser: user, realUser });

		revalidatePath("/[locale]/dashboard", "layout");
		redirect({ href: "/dashboard", locale });
	}

	await auth.deleteSessionCookie();
	await auth.deleteSession(session.id);

	redirect({ href: "/", locale });
}
