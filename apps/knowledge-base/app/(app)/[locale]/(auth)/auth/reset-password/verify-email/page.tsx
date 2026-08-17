import { globalGetRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Link } from "@dariah-eric/ui/link";
import { Text } from "@dariah-eric/ui/text";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { PasswordResetEmailVerificationForm } from "@/app/(app)/[locale]/(auth)/auth/reset-password/verify-email/_components/password-reset-email-verification-form";
import { Main } from "@/components/main";
import { auth } from "@/lib/auth";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface PasswordResetVerifyEmailPageProps extends PageProps<"/[locale]/auth/reset-password/verify-email"> {}

export async function generateMetadata(
	_props: Readonly<PasswordResetVerifyEmailPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Verify email address"),
	});

	return metadata;
}

export default async function PasswordResetVerifyEmailPage(
	_props: Readonly<PasswordResetVerifyEmailPageProps>,
): Promise<ReactNode> {
	const locale = await getLocale();

	const t = await getExtracted();

	if (!(await globalGetRequestRateLimit())) {
		return t("Too many requests.");
	}

	const { session } = await auth.validatePasswordResetSessionFromRequest();

	if (session == null) {
		redirect({ href: "/auth/forgot-password", locale });
	}

	if (session.isEmailVerified) {
		if (!session.isTwoFactorVerified) {
			redirect({ href: "/auth/reset-password/two-factor", locale });
		}

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
					<h1 className="text-xl/10 font-semibold">{t("Verify your email address")}</h1>

					<Text>{t("We sent an 8-digit code to {email}.", { email: session.email })}</Text>
				</div>

				<PasswordResetEmailVerificationForm />
			</div>
		</Main>
	);
}
