import { getLocale } from "next-intl/server";
import { forbidden } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { redirect } from "@/lib/navigation/navigation";

export const getCurrentSession = cache(auth.getCurrentSession);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertAuthenticated() {
	const result = await getCurrentSession();

	const locale = await getLocale();

	if (result.session == null) {
		redirect({ href: "/auth/sign-in", locale });
	}

	if (!result.user.isEmailVerified) {
		redirect({ href: "/auth/verify-email", locale });
	}

	if (!result.user.isTwoFactorRegistered) {
		redirect({ href: "/auth/two-factor/setup", locale });
	}

	if (!result.session.isTwoFactorVerified) {
		redirect({ href: "/auth/two-factor", locale });
	}

	return result;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertAdmin() {
	const result = await assertAuthenticated();

	const locale = await getLocale();

	if (result.user.role !== "admin") {
		redirect({ href: "/dashboard", locale });
	}

	return result;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertAdminPageAccess() {
	const result = await assertAuthenticated();

	if (result.user.role !== "admin") {
		forbidden();
	}

	return result;
}
