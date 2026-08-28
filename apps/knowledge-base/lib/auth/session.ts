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

	/**
	 * Gated on `realUser`, never on the effective user. Checking the impersonated user would walk an
	 * admin acting as someone who has not set up two-factor into `/auth/two-factor/setup`, and enroll
	 * a TOTP key on that person's account.
	 */
	if (!result.realUser.isEmailVerified) {
		redirect({ href: "/auth/verify-email", locale });
	}

	if (!result.realUser.isTwoFactorRegistered) {
		redirect({ href: "/auth/two-factor/setup", locale });
	}

	if (!result.session.isTwoFactorVerified) {
		redirect({ href: "/auth/two-factor", locale });
	}

	return result;
}

/**
 * Guards anything that mutates the credential behind a session -- account settings, two-factor,
 * recovery codes, email verification. `assertAuthenticated` alone is not enough for those: while
 * impersonating, the effective user is someone else, so the mutation would land on their account.
 *
 * Layouts do not protect server actions, so route-level use of this must be paired with the
 * `requireNoImpersonation` option on the action factories.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function assertNotImpersonating() {
	const result = await assertAuthenticated();

	if (result.isImpersonating) {
		forbidden();
	}

	return result;
}

/**
 * Reads the _effective_ role, so an admin impersonating a non-admin loses the admin routes for the
 * duration. That is the point of the feature rather than a limitation of it: they are meant to see
 * what the person they are helping sees.
 */
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
