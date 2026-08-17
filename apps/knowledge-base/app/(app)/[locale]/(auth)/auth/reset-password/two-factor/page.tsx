import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { PasswordResetRecoveryCodeForm } from "@/app/(app)/[locale]/(auth)/auth/reset-password/two-factor/_components/password-reset-recovery-code-form";
import { PasswordResetTotpForm } from "@/app/(app)/[locale]/(auth)/auth/reset-password/two-factor/_components/password-reset-totp-form";
import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface PasswordResetTwoFactorPageProps extends PageProps<"/[locale]/auth/reset-password/two-factor"> {}

export async function generateMetadata(
	_props: Readonly<PasswordResetTwoFactorPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Two-factor authentication"),
	});

	return metadata;
}

export default async function PasswordResetTwoFactorPage(
	_props: Readonly<PasswordResetTwoFactorPageProps>,
): Promise<ReactNode> {
	const locale = await getLocale();

	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { session, user } = await auth.validatePasswordResetSessionFromRequest();

	if (session == null) {
		redirect({ href: "/auth/forgot-password", locale });
	}

	if (!session.isEmailVerified) {
		redirect({ href: "/auth/reset-password/verify-email", locale });
	}

	if (!user.isTwoFactorRegistered) {
		redirect({ href: "/auth/reset-password", locale });
	}

	if (session.isTwoFactorVerified) {
		redirect({ href: "/auth/reset-password", locale });
	}

	return (
		<Main className="min-block-full p-6 items-center justify-center flex flex-col">
			<div className="inline-full max-inline-sm flex flex-col gap-y-4">
				<Link aria-label={t("Home")} className="mbe-2 rounded-xs self-start inline-block" href="/">
					<Avatar
						className="dark:invert"
						isSquare={true}
						size="md"
						src="/assets/images/logo-dariah.svg"
					/>
				</Link>

				<div>
					<h1 className="text-xl/10 font-semibold">{t("Two-factor authentication")}</h1>
				</div>

				<div className="flex flex-col gap-y-8">
					<section className="flex flex-col gap-y-2">
						<Text>{t("Enter the code from your authenticator app.")}</Text>

						<PasswordResetTotpForm />
					</section>

					<section className="flex flex-col gap-y-2">
						<Text>{t("Use your recovery code instead")}</Text>

						<PasswordResetRecoveryCodeForm />
					</section>
				</div>
			</div>
		</Main>
	);
}
