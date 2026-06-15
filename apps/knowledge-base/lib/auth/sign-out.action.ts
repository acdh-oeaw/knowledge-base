"use server";

import { getLocale } from "next-intl/server";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "@/lib/navigation/navigation";

export async function signOutAction(): Promise<void> {
	const locale = await getLocale();

	const { session } = await getCurrentSession();

	if (session == null) {
		redirect({ href: "/", locale });
	}

	await auth.deleteSessionCookie();
	await auth.deleteSession(session.id);

	redirect({ href: "/", locale });
}
