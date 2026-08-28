"use client";

import { Button } from "@dariah-eric/ui/button";
import { ExclamationTriangleIcon as IconWarning } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { stopImpersonationAction } from "@/lib/auth/stop-impersonation.action";

interface ImpersonationBannerProps {
	/** The person whose account is currently being acted as. */
	impersonatedUserName: string;
	/** Whether that person has verified their email address. */
	impersonatedUserIsEmailVerified: boolean;
	/** Whether that person has registered a two-factor authenticator. */
	impersonatedUserIsTwoFactorRegistered: boolean;
	/** The admin doing the impersonating, named so the banner is unambiguous on a shared screen. */
	realUserName: string;
}

/**
 * Deliberately loud and unconditionally visible: the whole risk of impersonation is an admin
 * forgetting they are in it and reading someone else's view as their own.
 */
export function ImpersonationBanner(props: Readonly<ImpersonationBannerProps>): ReactNode {
	const {
		impersonatedUserIsEmailVerified,
		impersonatedUserIsTwoFactorRegistered,
		impersonatedUserName,
		realUserName,
	} = props;

	const t = useExtracted();

	/**
	 * Impersonation carries the _admin's_ completed sign-in, so someone who has not finished
	 * onboarding can be acted as even though they could not reach these screens themselves. Saying so
	 * turns the mismatch into information: without it, an admin helping with "I can't get past this
	 * screen" would see a working dashboard and conclude the problem had gone away.
	 */
	function getOnboardingNotice(): string | null {
		if (!impersonatedUserIsEmailVerified && !impersonatedUserIsTwoFactorRegistered) {
			return t(
				"They have not verified their email or set up two-factor authentication, so they cannot sign in themselves yet — you are seeing more than they can.",
			);
		}

		if (!impersonatedUserIsEmailVerified) {
			return t(
				"They have not verified their email, so they cannot sign in themselves yet — you are seeing more than they can.",
			);
		}

		if (!impersonatedUserIsTwoFactorRegistered) {
			return t(
				"They have not set up two-factor authentication, so they cannot sign in themselves yet — you are seeing more than they can.",
			);
		}

		return null;
	}

	const onboardingNotice = getOnboardingNotice();

	return (
		<div
			className="flex flex-wrap items-center gap-x-3 gap-y-2 border-be border-current/15 bg-warning-subtle px-(--layout-padding) py-2 text-warning-subtle-fg [--layout-padding:--spacing(4)] sm:text-sm/6 sm:[--layout-padding:--spacing(6)]"
			role="status"
		>
			<IconWarning aria-hidden={true} className="shrink-0 block-5 inline-5" />

			<p className="text-sm">
				{t("You are signed in as {name}.", { name: impersonatedUserName })}{" "}
				<span className="opacity-80">
					{t("Your own account is {name}.", { name: realUserName })}
				</span>
				{onboardingNotice != null ? (
					<span className="block font-medium">{onboardingNotice}</span>
				) : null}
			</p>

			<form
				action={stopImpersonationAction}
				className="ms-auto"
				/**
				 * A plain form post rather than an `onAction` handler, so returning to your own account
				 * keeps working if client-side JavaScript fails to load or errors.
				 */
			>
				<Button intent="outline" size="xs" type="submit">
					{t("Return to my account")}
				</Button>
			</form>
		</div>
	);
}
